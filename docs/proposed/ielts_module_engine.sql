-- REVIEW PROPOSAL ONLY. Do not run on the shared production project without approval.
-- Source keys are intentionally absent: this GitHub repository is public.
-- Import private answers through a controlled, uncommitted SQL file after source review.
-- Existing coaching migrations 018/019/020 and review RPCs are not replaced.

create schema if not exists coaching_private;
revoke all on schema coaching_private from public, anon, authenticated;

create table if not exists coaching_private.module_answer_keys (
  module_id uuid not null references public.learning_modules(id) on delete restrict,
  activity_id text not null,
  answer jsonb not null,
  explanations jsonb not null,
  primary key (module_id, activity_id)
);
alter table coaching_private.module_answer_keys enable row level security;
revoke all on coaching_private.module_answer_keys from public, anon, authenticated;

create table if not exists public.coaching_module_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.coaching_tasks(id) on delete restrict,
  module_id uuid not null references public.learning_modules(id) on delete restrict,
  content_version integer not null check (content_version > 0),
  student_id uuid not null references public.profiles(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  resume_stage text not null default 'Discover'
    check (resume_stage in ('Discover','Learn','Practice','Apply','Reflect','Verify')),
  completed_stages text[] not null default '{}',
  stage_data jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress'
    check (status in ('in_progress','awaiting_review','revision_required','mastered')),
  verify_submission_id uuid references public.coaching_submissions(id) on delete restrict,
  completed_at timestamptz,
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, student_id, attempt_number)
);
create index if not exists coaching_module_attempts_student_task_idx
  on public.coaching_module_attempts(student_id, task_id, attempt_number desc);
create index if not exists coaching_module_attempts_verify_idx
  on public.coaching_module_attempts(verify_submission_id);

create table if not exists public.coaching_module_activity_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.coaching_module_attempts(id) on delete restrict,
  activity_id text not null,
  response jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists coaching_module_activity_attempts_lookup_idx
  on public.coaching_module_activity_attempts(attempt_id, activity_id, created_at desc);

create table if not exists public.coaching_module_recordings (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.coaching_module_attempts(id) on delete restrict,
  prompt_id text not null,
  storage_path text not null unique,
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);
create index if not exists coaching_module_recordings_lookup_idx
  on public.coaching_module_recordings(attempt_id, prompt_id, created_at desc);

alter table public.coaching_module_attempts enable row level security;
alter table public.coaching_module_activity_attempts enable row level security;
alter table public.coaching_module_recordings enable row level security;

-- All writes use narrowly checked RPCs. SELECT policies allow own data and assigned coach.
revoke all on public.coaching_module_attempts,
  public.coaching_module_activity_attempts,
  public.coaching_module_recordings from public, anon, authenticated;
grant select on public.coaching_module_attempts,
  public.coaching_module_activity_attempts,
  public.coaching_module_recordings to authenticated;

create policy "Students read own module attempts"
on public.coaching_module_attempts for select to authenticated
using (student_id = (select auth.uid()) and public.get_user_role() = 'student');
create policy "Coaches read assigned module attempts"
on public.coaching_module_attempts for select to authenticated
using (
  public.get_user_role() = 'teacher' and exists (
    select 1 from public.coaching_tasks ct
    join public.coaching_weekly_plans wp on wp.id = ct.weekly_plan_id
    join public.coaching_enrollments e on e.id = wp.enrollment_id
    where ct.id = task_id and e.coach_id = (select auth.uid())
  )
);
create policy "Admins read module attempts"
on public.coaching_module_attempts for select to authenticated
using (public.get_user_role() = 'admin');

create policy "Students read own module activities"
on public.coaching_module_activity_attempts for select to authenticated
using (exists (select 1 from public.coaching_module_attempts a
  where a.id = attempt_id and a.student_id = (select auth.uid())));
create policy "Coaches read assigned module activities"
on public.coaching_module_activity_attempts for select to authenticated
using (exists (select 1 from public.coaching_module_attempts a
  where a.id = attempt_id));
-- The above policies compose through coaching_module_attempts RLS.

create policy "Students read own module recordings"
on public.coaching_module_recordings for select to authenticated
using (exists (select 1 from public.coaching_module_attempts a
  where a.id = attempt_id and a.student_id = (select auth.uid())));
create policy "Coaches read assigned module recordings"
on public.coaching_module_recordings for select to authenticated
using (exists (select 1 from public.coaching_module_attempts a
  where a.id = attempt_id));

-- Existing Storage policies permit students to update/delete their files.
-- Once a file is evidence in module history, prevent replacement/removal.
create policy "Preserve referenced module recordings on update"
on storage.objects as restrictive for update to authenticated
using (not exists (select 1 from public.coaching_module_recordings r
  where r.storage_path = name and bucket_id = 'coaching-submissions'));
create policy "Preserve referenced module recordings on delete"
on storage.objects as restrictive for delete to authenticated
using (not exists (select 1 from public.coaching_module_recordings r
  where r.storage_path = name and bucket_id = 'coaching-submissions'));

create or replace function public.start_coaching_module_attempt(p_task_id uuid)
returns public.coaching_module_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.coaching_tasks;
  v_previous public.coaching_module_attempts;
  v_result public.coaching_module_attempts;
begin
  if auth.uid() is null or public.get_user_role() <> 'student' then
    raise exception 'Student authentication required';
  end if;
  select ct.* into v_task from public.coaching_tasks ct
  join public.coaching_weekly_plans wp on wp.id = ct.weekly_plan_id
  join public.coaching_enrollments e on e.id = wp.enrollment_id
  join public.learning_modules m on m.id = ct.module_id and m.is_published
  where ct.id = p_task_id and e.student_id = auth.uid() and e.status = 'active';
  if v_task.id is null then raise exception 'Assigned published module not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text || auth.uid()::text, 0));
  select * into v_previous from public.coaching_module_attempts
  where task_id = p_task_id and student_id = auth.uid()
  order by attempt_number desc limit 1;
  if v_previous.id is not null and v_previous.status <> 'revision_required' then
    return v_previous;
  end if;
  insert into public.coaching_module_attempts
    (task_id,module_id,content_version,student_id,attempt_number,resume_stage,completed_stages,stage_data)
  values (
    p_task_id,v_task.module_id,
    (select (m.content->>'content_version')::integer from public.learning_modules m where m.id = v_task.module_id),
    auth.uid(),coalesce(v_previous.attempt_number,0)+1,
    case when v_previous.id is null then 'Discover' else 'Verify' end,
    case when v_previous.id is null then '{}'::text[] else
      array_remove(v_previous.completed_stages, 'Verify') end,
    case when v_previous.id is null then '{}'::jsonb else v_previous.stage_data end
  ) returning * into v_result;
  return v_result;
end $$;

create or replace function public.save_coaching_module_progress(
  p_attempt_id uuid, p_stage text, p_data jsonb, p_complete boolean
) returns public.coaching_module_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt public.coaching_module_attempts;
  v_stages text[] := array['Discover','Learn','Practice','Apply','Reflect','Verify'];
  v_index integer;
  v_result public.coaching_module_attempts;
begin
  select * into v_attempt from public.coaching_module_attempts
  where id = p_attempt_id and student_id = auth.uid() and status = 'in_progress'
  for update;
  if v_attempt.id is null or public.get_user_role() <> 'student' then
    raise exception 'Module attempt not editable';
  end if;
  v_index := array_position(v_stages,p_stage);
  if v_index is null or p_stage = 'Verify' or
     v_index > coalesce(array_position(v_stages,v_attempt.resume_stage),1) then
    raise exception 'Stage unavailable';
  end if;
  if pg_catalog.octet_length(coalesce(p_data,'{}'::jsonb)::text) > 65536 then
    raise exception 'Stage data too large';
  end if;
  if p_complete then
    if p_stage = 'Discover' and not exists (
      select 1 from public.coaching_module_recordings
      where attempt_id = p_attempt_id and prompt_id = 'discover'
    ) then raise exception 'Discover recording required'; end if;
    if p_stage = 'Practice' and (
      not exists (select 1 from public.coaching_module_activity_attempts
        where attempt_id = p_attempt_id and activity_id = 'ree-mcq')
      or not exists (select 1 from public.coaching_module_activity_attempts
        where attempt_id = p_attempt_id and activity_id = 'ree-matching')
    ) then raise exception 'Both practice activities required'; end if;
    if p_stage = 'Apply' and (
      select count(distinct prompt_id) from public.coaching_module_recordings
      where attempt_id = p_attempt_id and prompt_id in ('apply-1','apply-2','apply-3')
    ) <> 3 then raise exception 'Three Apply recordings required'; end if;
    if p_stage = 'Reflect' then
      if coalesce(pg_catalog.jsonb_typeof(p_data->'checklist'),'') <> 'array' then
        raise exception 'Five reflection items required';
      end if;
      if pg_catalog.jsonb_array_length(p_data->'checklist') <> 5 or
         exists (select 1 from pg_catalog.jsonb_array_elements(p_data->'checklist') item
           where pg_catalog.jsonb_typeof(item) <> 'boolean')
      then raise exception 'Five reflection items required'; end if;
    end if;
  end if;
  update public.coaching_module_attempts
  set stage_data = pg_catalog.jsonb_set(stage_data,array[p_stage],coalesce(p_data,'{}'::jsonb),true),
      completed_stages = case when p_complete and not p_stage = any(completed_stages)
        then array_append(completed_stages,p_stage) else completed_stages end,
      resume_stage = case when p_complete and v_index < 6 and
        v_index >= array_position(v_stages,v_attempt.resume_stage)
        then v_stages[v_index+1] else resume_stage end,
      updated_at = now()
  where id = p_attempt_id returning * into v_result;
  return v_result;
end $$;

create or replace function public.submit_coaching_module_activity(
  p_attempt_id uuid, p_activity_id text, p_response jsonb
) returns public.coaching_module_activity_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt public.coaching_module_attempts;
  v_key coaching_private.module_answer_keys;
  v_item record;
  v_result jsonb := '{}'::jsonb;
  v_saved public.coaching_module_activity_attempts;
begin
  select * into v_attempt from public.coaching_module_attempts
  where id = p_attempt_id and student_id = auth.uid() and status = 'in_progress';
  if v_attempt.id is null or public.get_user_role() <> 'student' or
     (v_attempt.resume_stage <> 'Practice' and
      not 'Practice' = any(v_attempt.completed_stages)) then
    raise exception 'Practice not available';
  end if;
  select * into v_key from coaching_private.module_answer_keys
  where module_id = v_attempt.module_id and activity_id = p_activity_id;
  if v_key.module_id is null then raise exception 'Activity key unavailable'; end if;
  if pg_catalog.jsonb_typeof(p_response) <> 'object' or
     (select count(*) from pg_catalog.jsonb_object_keys(p_response)) <>
     (select count(*) from pg_catalog.jsonb_object_keys(v_key.answer)) then
    raise exception 'Complete activity response required';
  end if;
  for v_item in select key,value from pg_catalog.jsonb_each(v_key.answer) loop
    if not p_response ? v_item.key then raise exception 'Missing answer'; end if;
    v_result := v_result || pg_catalog.jsonb_build_object(v_item.key,
      pg_catalog.jsonb_build_object(
        'correct', p_response->v_item.key = v_item.value,
        'answer', v_item.value,
        'explanation', v_key.explanations->>v_item.key
      ));
  end loop;
  insert into public.coaching_module_activity_attempts
    (attempt_id,activity_id,response,result)
  values (p_attempt_id,p_activity_id,p_response,v_result)
  returning * into v_saved;
  return v_saved;
end $$;

create or replace function public.save_coaching_module_recording(
  p_attempt_id uuid, p_prompt_id text, p_storage_path text, p_duration_seconds integer
) returns public.coaching_module_recordings
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt public.coaching_module_attempts;
  v_saved public.coaching_module_recordings;
begin
  select * into v_attempt from public.coaching_module_attempts
  where id = p_attempt_id and student_id = auth.uid() and status = 'in_progress';
  if v_attempt.id is null or public.get_user_role() <> 'student' then
    raise exception 'Module attempt not editable';
  end if;
  if p_prompt_id not in ('discover','apply-1','apply-2','apply-3','verify') or
     p_duration_seconds is null or p_duration_seconds <= 0 or
     p_storage_path not like auth.uid()::text || '/' || v_attempt.task_id::text || '/%' or
     not exists (select 1 from storage.objects
       where bucket_id = 'coaching-submissions' and name = p_storage_path)
  then raise exception 'Invalid recording'; end if;
  insert into public.coaching_module_recordings
    (attempt_id,prompt_id,storage_path,duration_seconds)
  values (p_attempt_id,p_prompt_id,p_storage_path,p_duration_seconds)
  returning * into v_saved;
  return v_saved;
end $$;

create or replace function public.submit_coaching_module_verify(
  p_attempt_id uuid, p_submission_id uuid
) returns public.coaching_module_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt public.coaching_module_attempts;
  v_submission public.coaching_submissions;
  v_saved public.coaching_module_attempts;
begin
  select * into v_attempt from public.coaching_module_attempts
  where id = p_attempt_id and student_id = auth.uid() for update;
  if v_attempt.id is null or public.get_user_role() <> 'student' or
     v_attempt.status not in ('in_progress','awaiting_review') or
     not v_attempt.completed_stages @> array['Discover','Learn','Practice','Apply','Reflect']::text[]
  then raise exception 'Required stages incomplete'; end if;
  select * into v_submission from public.coaching_submissions
  where id = p_submission_id and task_id = v_attempt.task_id
    and student_id = auth.uid() and status = 'submitted';
  if v_submission.id is null or not exists (
    select 1 from public.coaching_module_recordings
    where attempt_id = p_attempt_id and prompt_id = 'verify'
      and storage_path = v_submission.storage_path
      and duration_seconds = v_submission.duration_seconds
  ) then raise exception 'Verify submission and recording must match'; end if;
  update public.coaching_module_attempts set
    verify_submission_id = p_submission_id,
    status = 'awaiting_review',
    completed_stages = case when 'Verify' = any(completed_stages)
      then completed_stages else array_append(completed_stages,'Verify') end,
    completed_at = coalesce(completed_at,now()),
    resume_stage = 'Verify',
    updated_at = now()
  where id = p_attempt_id returning * into v_saved;
  return v_saved;
end $$;

create or replace function public.review_coaching_module_submission(
  p_submission_id uuid, p_feedback_text text, p_scores jsonb, p_request_revision boolean
) returns public.coaching_module_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt public.coaching_module_attempts;
  v_submission public.coaching_submissions;
  v_criterion text;
  v_score integer;
  v_total integer := 0;
  v_no_zero boolean := true;
  v_pass boolean;
  v_saved public.coaching_module_attempts;
begin
  if public.get_user_role() <> 'teacher' or auth.uid() is null then
    raise exception 'Coach authentication required';
  end if;
  if p_feedback_text is null or pg_catalog.btrim(p_feedback_text) = '' then
    raise exception 'Coach feedback required';
  end if;
  select * into v_attempt from public.coaching_module_attempts
  where verify_submission_id = p_submission_id and status = 'awaiting_review'
  order by attempt_number desc limit 1 for update;
  select * into v_submission from public.coaching_submissions where id = p_submission_id;
  if v_attempt.id is null or v_submission.id is null or
     v_attempt.module_id <> 'eaab8a50-243b-4ea6-a8d4-59c58120ef01'::uuid or
     pg_catalog.jsonb_typeof(p_scores) <> 'object' or
     (select count(*) from pg_catalog.jsonb_object_keys(p_scores)) <> 4
  then raise exception 'Invalid REE review'; end if;
  foreach v_criterion in array array['respond','explain','example','coherence'] loop
    if not p_scores ? v_criterion or
       (p_scores->>v_criterion) !~ '^[0-2]$'
    then raise exception 'Each rubric criterion requires a score 0–2'; end if;
    v_score := (p_scores->>v_criterion)::integer;
    v_total := v_total + v_score;
    if v_score = 0 then v_no_zero := false; end if;
  end loop;
  v_pass := v_total >= 6 and v_no_zero
    and v_submission.duration_seconds between 20 and 30
    and not p_request_revision;
  -- Reuse the existing coach RPC so canonical feedback and revision history stay in sync.
  perform public.review_coaching_submission(
    p_submission_id,p_feedback_text,v_total,
    pg_catalog.jsonb_build_object('module_id',v_attempt.module_id,
      'content_version',v_attempt.content_version,'criteria',p_scores,'mastered',v_pass),
    not v_pass
  );
  update public.coaching_module_attempts set
    status = case when v_pass then 'mastered' else 'revision_required' end,
    mastered_at = case when v_pass then now() else null end,
    updated_at = now()
  where id = v_attempt.id returning * into v_saved;
  return v_saved;
end $$;

revoke all on function public.start_coaching_module_attempt(uuid),
  public.save_coaching_module_progress(uuid,text,jsonb,boolean),
  public.submit_coaching_module_activity(uuid,text,jsonb),
  public.save_coaching_module_recording(uuid,text,text,integer),
  public.submit_coaching_module_verify(uuid,uuid),
  public.review_coaching_module_submission(uuid,text,jsonb,boolean)
  from public, anon;
grant execute on function public.start_coaching_module_attempt(uuid),
  public.save_coaching_module_progress(uuid,text,jsonb,boolean),
  public.submit_coaching_module_activity(uuid,text,jsonb),
  public.save_coaching_module_recording(uuid,text,text,integer),
  public.submit_coaching_module_verify(uuid,uuid),
  public.review_coaching_module_submission(uuid,text,jsonb,boolean)
  to authenticated;

-- Seed metadata only. Publication remains blocked until source review, private key
-- import, missing Learn audio, and access/role tests are complete.
insert into public.learning_modules
  (id,title,description,program,skill,level,content,estimated_minutes,is_published)
values (
  'eaab8a50-243b-4ea6-a8d4-59c58120ef01',
  'Simple Answer Development (Part 1)',
  'Respond → Explain → Example (REE)',
  'IELTS','Speaking','B1',
  '{"manifest_key":"ielts-speaking-simple-answer-development-part-1","content_version":1,"source_revision":"SharePoint modified 2026-11-23T01:37:43Z"}'::jsonb,
  21,false
)
on conflict (id) do nothing;

create unique index if not exists learning_modules_manifest_version_key
  on public.learning_modules ((content->>'manifest_key'),(content->>'content_version'))
  where content ? 'manifest_key';

create or replace function public.protect_published_coaching_module()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.is_published and old.content ? 'manifest_key' and
     (new.content is distinct from old.content or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.skill is distinct from old.skill or new.level is distinct from old.level
      or new.estimated_minutes is distinct from old.estimated_minutes)
  then raise exception 'Published module versions are immutable; create a new version'; end if;
  if new.is_published and new.content ? 'manifest_key' and
     (tg_op = 'INSERT' or not old.is_published) and
     (select count(*) from coaching_private.module_answer_keys k
      where k.module_id = new.id and k.activity_id in ('ree-mcq','ree-matching')) <> 2
  then raise exception 'Private answer keys required before publication'; end if;
  return new;
end $$;
create trigger protect_published_coaching_module_trigger
before insert or update on public.learning_modules
for each row execute function public.protect_published_coaching_module();
revoke all on function public.protect_published_coaching_module() from public, anon, authenticated;
