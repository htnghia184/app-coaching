-- REVIEW ONLY: apply to verified Supabase Local for tests; never production without review.
-- Generic module state is independent of legacy REE attempt tables.
create table public.coaching_generic_module_versions (
  module_key text not null,
  content_version integer not null check (content_version > 0),
  module_id uuid not null references public.learning_modules(id),
  manifest jsonb not null,
  published_at timestamptz not null default now(),
  primary key (module_key, content_version),
  unique (module_id, content_version),
  check (manifest->>'moduleId' = module_key and (manifest->>'contentVersion')::integer = content_version)
);
create table public.coaching_generic_task_assignments (
  task_id uuid primary key references public.coaching_tasks(id),
  module_key text not null,
  content_version integer not null,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  foreign key (module_key, content_version) references public.coaching_generic_module_versions(module_key, content_version)
);
create table public.coaching_generic_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.coaching_generic_task_assignments(task_id),
  student_id uuid not null references public.profiles(id),
  attempt_number integer not null check (attempt_number > 0),
  module_key text not null,
  content_version integer not null,
  completed_stages jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress','awaiting_review','revision_required','completed')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (task_id, student_id, attempt_number),
  foreign key (module_key, content_version) references public.coaching_generic_module_versions(module_key, content_version)
);
create table public.coaching_generic_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.coaching_generic_attempts(id),
  activity_id text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);
create table public.coaching_generic_recordings (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.coaching_generic_attempts(id),
  prompt_id text not null,
  storage_path text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);
create table public.coaching_generic_submissions (
  attempt_id uuid primary key references public.coaching_generic_attempts(id),
  submission_revision_id uuid not null unique references public.coaching_submission_revisions(id),
  submitted_at timestamptz not null default now()
);

create function coaching_private.reject_generic_version_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Published module versions are immutable';
end $$;
create trigger immutable_generic_module_version before update or delete on public.coaching_generic_module_versions
for each row execute function coaching_private.reject_generic_version_mutation();

alter table public.coaching_generic_module_versions enable row level security;
alter table public.coaching_generic_task_assignments enable row level security;
alter table public.coaching_generic_attempts enable row level security;
alter table public.coaching_generic_responses enable row level security;
alter table public.coaching_generic_recordings enable row level security;
alter table public.coaching_generic_submissions enable row level security;
revoke all on public.coaching_generic_module_versions, public.coaching_generic_task_assignments,
 public.coaching_generic_attempts, public.coaching_generic_responses, public.coaching_generic_recordings,
 public.coaching_generic_submissions from public, anon, authenticated;
grant select on public.coaching_generic_module_versions, public.coaching_generic_task_assignments,
 public.coaching_generic_attempts, public.coaching_generic_responses, public.coaching_generic_recordings,
 public.coaching_generic_submissions to authenticated;
create policy "version readers" on public.coaching_generic_module_versions for select to authenticated
 using (exists (select 1 from public.coaching_generic_task_assignments a
   join public.coaching_tasks t on t.id=a.task_id
   join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
   join public.coaching_enrollments e on e.id=w.enrollment_id
   where a.module_key=module_key and a.content_version=content_version
   and (e.student_id=auth.uid() or e.coach_id=auth.uid())) or public.get_user_role() in ('teacher','admin'));
create policy "assignment readers" on public.coaching_generic_task_assignments for select to authenticated
 using (exists (select 1 from public.coaching_tasks t
   join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
   join public.coaching_enrollments e on e.id=w.enrollment_id
   where t.id=task_id and (e.student_id=auth.uid() or e.coach_id=auth.uid() or public.get_user_role()='admin')));
create policy "attempt readers" on public.coaching_generic_attempts for select to authenticated
 using (exists (select 1 from public.coaching_tasks t
   join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
   join public.coaching_enrollments e on e.id=w.enrollment_id
   where t.id=task_id and e.student_id=student_id
   and (e.student_id=auth.uid() or e.coach_id=auth.uid() or public.get_user_role()='admin')));
create policy "response readers" on public.coaching_generic_responses for select to authenticated
 using (exists (select 1 from public.coaching_generic_attempts a where a.id=attempt_id));
create policy "recording readers" on public.coaching_generic_recordings for select to authenticated
 using (exists (select 1 from public.coaching_generic_attempts a where a.id=attempt_id));
create policy "submission readers" on public.coaching_generic_submissions for select to authenticated
 using (exists (select 1 from public.coaching_generic_attempts a where a.id=attempt_id));

create function public.assign_generic_coaching_module(p_task uuid,p_module_key text,p_content_version integer)
returns public.coaching_generic_task_assignments language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_task_assignments; v_module uuid;
begin
  if auth.uid() is null or public.get_user_role()<>'teacher' then raise exception 'Coach required'; end if;
  select m.module_id into v_module from public.coaching_generic_module_versions m
    join public.coaching_tasks t on t.module_id=m.module_id
    join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
    join public.coaching_enrollments e on e.id=w.enrollment_id
    where t.id=p_task and m.module_key=p_module_key and m.content_version=p_content_version and e.coach_id=auth.uid();
  if v_module is null then raise exception 'Assigned task and immutable module version required'; end if;
  insert into public.coaching_generic_task_assignments(task_id,module_key,content_version,assigned_by)
    values(p_task,p_module_key,p_content_version,auth.uid()) returning * into v;
  return v;
end $$;
revoke all on function public.assign_generic_coaching_module(uuid,text,integer) from public, anon;
grant execute on function public.assign_generic_coaching_module(uuid,text,integer) to authenticated;

create function public.start_generic_coaching_attempt(p_task uuid) returns public.coaching_generic_attempts
language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_attempts; v_key text; v_version integer;
begin
  if auth.uid() is null or public.get_user_role()<>'student' then raise exception 'Student required'; end if;
  select a.module_key,a.content_version into v_key,v_version from public.coaching_generic_task_assignments a
    join public.coaching_tasks t on t.id=a.task_id
    join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
    join public.coaching_enrollments e on e.id=w.enrollment_id
    where a.task_id=p_task and e.student_id=auth.uid();
  if v_key is null then raise exception 'Assigned module required'; end if;
  select * into v from public.coaching_generic_attempts
    where task_id=p_task and student_id=auth.uid() and status='in_progress' order by attempt_number desc limit 1;
  if v.id is not null then return v; end if;
  insert into public.coaching_generic_attempts(task_id,student_id,attempt_number,module_key,content_version)
    values(p_task,auth.uid(),coalesce((select max(attempt_number)+1 from public.coaching_generic_attempts where task_id=p_task and student_id=auth.uid()),1),v_key,v_version)
    returning * into v;
  return v;
end $$;
revoke all on function public.start_generic_coaching_attempt(uuid) from public, anon;
grant execute on function public.start_generic_coaching_attempt(uuid) to authenticated;

create function public.save_generic_coaching_response(p_attempt uuid,p_activity text,p_response jsonb)
returns public.coaching_generic_responses language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_responses;
begin
  if jsonb_typeof(p_response) <> 'object' or not exists (select 1 from public.coaching_generic_attempts a
    join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress'
      and exists (select 1 from jsonb_array_elements(m.manifest->'stages') s,
        jsonb_array_elements(s->'activities') activity where activity->>'id'=p_activity)) then
    raise exception 'Active assigned activity required'; end if;
  insert into public.coaching_generic_responses(attempt_id,activity_id,response)
    values(p_attempt,p_activity,p_response) returning * into v;
  return v;
end $$;
revoke all on function public.save_generic_coaching_response(uuid,text,jsonb) from public, anon;
grant execute on function public.save_generic_coaching_response(uuid,text,jsonb) to authenticated;

create function public.complete_generic_coaching_stage(p_attempt uuid,p_stage text)
returns public.coaching_generic_attempts language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_attempts;
begin
  update public.coaching_generic_attempts a set completed_stages =
    case when a.completed_stages ? p_stage then a.completed_stages else a.completed_stages || to_jsonb(p_stage) end
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress'
    and exists (select 1 from public.coaching_generic_module_versions m
      where m.module_key=a.module_key and m.content_version=a.content_version
      and exists (select 1 from jsonb_array_elements(m.manifest->'stages') s where s->>'id'=p_stage))
    returning * into v;
  if v.id is null then raise exception 'Active assigned stage required'; end if;
  return v;
end $$;
revoke all on function public.complete_generic_coaching_stage(uuid,text) from public, anon;
grant execute on function public.complete_generic_coaching_stage(uuid,text) to authenticated;

create function public.save_generic_coaching_recording(p_attempt uuid,p_prompt text,p_path text,p_seconds integer)
returns public.coaching_generic_recordings language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_recordings;
begin
  if p_seconds not between 1 and 600 or p_path is null
    or not exists (select 1 from public.coaching_generic_attempts a
      join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version
      where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress'
      and p_path ~ ('^' || a.student_id::text || '/' || a.task_id::text || '/' || a.id::text || '/[a-zA-Z0-9_-]+[.]webm$')
      and exists (select 1 from storage.objects o where o.bucket_id='coaching-submissions' and o.name=p_path)
      and exists (select 1 from jsonb_array_elements(m.manifest->'stages') s,
        jsonb_array_elements(s->'activities') activity,
        jsonb_array_elements(case when activity->>'type'='recording' then activity->'payload'->'prompts' else '[]'::jsonb end) prompt
        where prompt->>'id'=p_prompt)) then raise exception 'Active assigned recording required'; end if;
  insert into public.coaching_generic_recordings(attempt_id,prompt_id,storage_path,duration_seconds)
    values(p_attempt,p_prompt,p_path,p_seconds) returning * into v;
  return v;
end $$;
revoke all on function public.save_generic_coaching_recording(uuid,text,text,integer) from public, anon;
grant execute on function public.save_generic_coaching_recording(uuid,text,text,integer) to authenticated;

create function public.submit_generic_coaching_verify(p_attempt uuid,p_submission_revision uuid)
returns public.coaching_generic_attempts language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_attempts; v_manifest jsonb; v_policy jsonb;
begin
  select m.manifest,m.manifest->'verifyPolicy' into v_manifest,v_policy
    from public.coaching_generic_attempts a join public.coaching_generic_module_versions m
      on m.module_key=a.module_key and m.content_version=a.content_version
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress';
  if v_manifest is null or exists (select 1 from jsonb_array_elements(v_manifest->'stages') s
    where s->>'id'<>'Verify' and not exists (select 1 from public.coaching_generic_attempts a
      where a.id=p_attempt and a.completed_stages ? (s->>'id'))) then
    raise exception 'Complete required stages before Verify';
  end if;
  if v_policy->>'kind'='rubric_sum' then
    if not exists (select 1 from public.coaching_generic_recordings r
      where r.attempt_id=p_attempt and exists (select 1 from jsonb_array_elements(v_manifest->'stages') s,
        jsonb_array_elements(s->'activities') activity,
        jsonb_array_elements(case when activity->>'type'='recording' then activity->'payload'->'prompts' else '[]'::jsonb end) prompt
        where s->>'id'='Verify' and prompt->>'id'=r.prompt_id)) then
      raise exception 'Fresh Verify recording required';
    end if;
  elsif v_policy->>'kind'='per_item_pass' then
    if exists (select 1 from jsonb_array_elements_text(v_policy->'itemIds') required
      where not exists (select 1 from public.coaching_generic_recordings r
        where r.attempt_id=p_attempt and r.prompt_id=required)) then
      raise exception 'All Apply recordings required';
    end if;
  else raise exception 'Unknown Verify policy'; end if;
  update public.coaching_generic_attempts a set status='awaiting_review',submitted_at=now()
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress'
    and exists (select 1 from public.coaching_submission_revisions r where r.id=p_submission_revision
      and r.task_id=a.task_id and r.student_id=a.student_id)
    returning * into v;
  if v.id is null then raise exception 'Own submitted revision and active attempt required'; end if;
  insert into public.coaching_generic_submissions(attempt_id,submission_revision_id) values(v.id,p_submission_revision);
  return v;
end $$;
revoke all on function public.submit_generic_coaching_verify(uuid,uuid) from public, anon;
grant execute on function public.submit_generic_coaching_verify(uuid,uuid) to authenticated;

create table public.coaching_generic_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.coaching_generic_attempts(id),
  reviewed_by uuid not null references public.profiles(id),
  review_data jsonb not null,
  passed boolean not null,
  reviewed_at timestamptz not null default now()
);
alter table public.coaching_generic_reviews enable row level security;
revoke all on public.coaching_generic_reviews from public, anon, authenticated;
grant select on public.coaching_generic_reviews to authenticated;
create policy "generic review readers" on public.coaching_generic_reviews for select to authenticated
 using (exists (select 1 from public.coaching_generic_attempts a where a.id=attempt_id));

create function public.review_generic_coaching_verify(p_attempt uuid,p_review jsonb)
returns public.coaching_generic_reviews language plpgsql security definer set search_path = '' as $$
declare v public.coaching_generic_reviews; v_manifest jsonb; v_policy jsonb; v_pass boolean; v_count integer; v_sum integer;
begin
  if auth.uid() is null or public.get_user_role()<>'teacher' then raise exception 'Assigned coach required'; end if;
  select m.manifest,m.manifest->'verifyPolicy' into v_manifest,v_policy
  from public.coaching_generic_attempts a
  join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version
  join public.coaching_tasks t on t.id=a.task_id
  join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
  join public.coaching_enrollments e on e.id=w.enrollment_id
  where a.id=p_attempt and a.status='awaiting_review' and e.coach_id=auth.uid();
  if v_manifest is null then raise exception 'Assigned pending attempt required'; end if;
  if v_policy->>'kind'='rubric_sum' then
    if jsonb_typeof(p_review->'scores')<>'array' or jsonb_array_length(p_review->'scores')<>4
      or exists (select 1 from jsonb_array_elements(p_review->'scores') score
        where jsonb_typeof(score)<>'number' or score::text !~ '^[0-2]$') then raise exception 'Four rubric scores from 0 to 2 required'; end if;
    select count(*),sum(score::text::integer) into v_count,v_sum from jsonb_array_elements(p_review->'scores') score where score::text::integer>0;
    v_pass := v_count=4 and v_sum>=6;
  elsif v_policy->>'kind'='per_item_pass' then
    if jsonb_typeof(p_review->'reviewedItems')<>'array' or jsonb_typeof(p_review->'passedItems')<>'array'
      or jsonb_typeof(p_review->'repeatedItems')<>'array' then raise exception 'Per-item review arrays required'; end if;
    v_pass := not exists (select 1 from jsonb_array_elements_text(v_policy->'itemIds') required
      where not (p_review->'reviewedItems' ? required))
      and (select count(distinct item) from jsonb_array_elements_text(p_review->'passedItems') item
        where v_policy->'itemIds' ? item)>=5
      and not exists (select 1 from jsonb_array_elements_text(p_review->'repeatedItems') item
        where v_policy->'itemIds' ? item);
  else raise exception 'Unknown Verify policy'; end if;
  insert into public.coaching_generic_reviews(attempt_id,reviewed_by,review_data,passed)
    values(p_attempt,auth.uid(),p_review,v_pass) returning * into v;
  update public.coaching_generic_attempts set status=case when v_pass then 'completed' else 'revision_required' end where id=p_attempt;
  return v;
end $$;
revoke all on function public.review_generic_coaching_verify(uuid,jsonb) from public, anon;
grant execute on function public.review_generic_coaching_verify(uuid,jsonb) to authenticated;
