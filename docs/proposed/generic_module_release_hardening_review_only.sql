-- REVIEW ONLY. Apply after generic_module_persistence_review_only.sql to Supabase Local.
-- Production migration ownership, rollout and rollback require separate approval.
drop policy if exists "version readers" on public.coaching_generic_module_versions;
create policy "version readers" on public.coaching_generic_module_versions for select to authenticated
using (public.get_user_role() in ('teacher','admin') or exists (
  select 1 from public.coaching_generic_task_assignments a
  join public.coaching_tasks t on t.id=a.task_id
  join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
  join public.coaching_enrollments e on e.id=w.enrollment_id
  where a.module_key=coaching_generic_module_versions.module_key
    and a.content_version=coaching_generic_module_versions.content_version
    and e.student_id=auth.uid()));
drop policy if exists "assignment readers" on public.coaching_generic_task_assignments;
create policy "assignment readers" on public.coaching_generic_task_assignments for select to authenticated
using (exists (select 1 from public.coaching_tasks t
  join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
  join public.coaching_enrollments e on e.id=w.enrollment_id
  where t.id=coaching_generic_task_assignments.task_id
  and (e.student_id=auth.uid() or e.coach_id=auth.uid() or public.get_user_role()='admin')));
drop policy if exists "attempt readers" on public.coaching_generic_attempts;
create policy "attempt readers" on public.coaching_generic_attempts for select to authenticated
using (exists (select 1 from public.coaching_tasks t
  join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
  join public.coaching_enrollments e on e.id=w.enrollment_id
  where t.id=coaching_generic_attempts.task_id and e.student_id=coaching_generic_attempts.student_id
  and (e.student_id=auth.uid() or e.coach_id=auth.uid() or public.get_user_role()='admin')));
drop policy if exists "response readers" on public.coaching_generic_responses;
create policy "response readers" on public.coaching_generic_responses for select to authenticated
using (exists (select 1 from public.coaching_generic_attempts a where a.id=coaching_generic_responses.attempt_id));
drop policy if exists "recording readers" on public.coaching_generic_recordings;
create policy "recording readers" on public.coaching_generic_recordings for select to authenticated
using (exists (select 1 from public.coaching_generic_attempts a where a.id=coaching_generic_recordings.attempt_id));
drop policy if exists "submission readers" on public.coaching_generic_submissions;
create policy "submission readers" on public.coaching_generic_submissions for select to authenticated
using (exists (select 1 from public.coaching_generic_attempts a where a.id=coaching_generic_submissions.attempt_id));
drop policy if exists "generic review readers" on public.coaching_generic_reviews;
create policy "generic review readers" on public.coaching_generic_reviews for select to authenticated
using (exists (select 1 from public.coaching_generic_attempts a where a.id=coaching_generic_reviews.attempt_id));

alter table public.coaching_generic_submissions add column request_key uuid unique;
create unique index coaching_generic_recordings_unique_prompt on public.coaching_generic_recordings(attempt_id,prompt_id);
create unique index coaching_generic_responses_unique_activity on public.coaching_generic_responses(attempt_id,activity_id);
create table public.coaching_generic_recording_rules (
  module_key text not null, content_version integer not null, prompt_id text not null,
  min_seconds integer not null check (min_seconds > 0), max_seconds integer not null check (max_seconds >= min_seconds),
  primary key(module_key,content_version,prompt_id),
  foreign key(module_key,content_version) references public.coaching_generic_module_versions(module_key,content_version)
);
alter table public.coaching_generic_recording_rules enable row level security;
revoke all on public.coaching_generic_recording_rules from public,anon,authenticated;

create function coaching_private.protect_generic_recording() returns trigger
language plpgsql set search_path='' as $$ begin
  raise exception 'Recording evidence is immutable';
end $$;
-- The revision-binding RPC is internal to the atomic wrapper; an authenticated
-- caller must not bypass the transactional coaching-submission path.
revoke execute on function public.submit_generic_coaching_verify(uuid,uuid) from authenticated;

create or replace function public.save_generic_coaching_response(p_attempt uuid,p_activity text,p_response jsonb)
returns public.coaching_generic_responses language plpgsql security definer set search_path='' as $$
declare v public.coaching_generic_responses; activity jsonb;
begin
  perform 1 from public.coaching_generic_attempts a where a.id=p_attempt and a.student_id=auth.uid() for update;
  select item into activity from public.coaching_generic_attempts a
  join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version,
  lateral jsonb_array_elements(m.manifest->'stages') s,
  lateral jsonb_array_elements(s->'activities') item
  where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress' and item->>'id'=p_activity;
  if activity is null or not coaching_private.validate_generic_activity_response(activity,p_response) then
    raise exception 'Typed activity response required'; end if;
  insert into public.coaching_generic_responses(attempt_id,activity_id,response)
    values(p_attempt,p_activity,p_response)
    on conflict(attempt_id,activity_id) do update set response=excluded.response,created_at=now()
    returning * into v;
  return v;
end $$;

create or replace function public.complete_generic_coaching_stage(p_attempt uuid,p_stage text)
returns public.coaching_generic_attempts language plpgsql security definer set search_path='' as $$
declare v public.coaching_generic_attempts; stage jsonb; activity jsonb;
begin
  perform 1 from public.coaching_generic_attempts a where a.id=p_attempt and a.student_id=auth.uid() for update;
  select s into stage from public.coaching_generic_attempts a
  join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version,
  lateral jsonb_array_elements(m.manifest->'stages') s
  where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress' and s->>'id'=p_stage;
  if stage is null or p_stage='Verify' then raise exception 'Active non-Verify stage required'; end if;
  for activity in select * from jsonb_array_elements(stage->'activities') loop
    if activity->>'type' in ('choice','matching','text_response','reflection') and not exists (
      select 1 from public.coaching_generic_responses r where r.attempt_id=p_attempt and r.activity_id=activity->>'id')
      then raise exception 'Required activity response missing'; end if;
    if activity->>'type'='recording' and exists (
      select 1 from jsonb_array_elements(activity->'payload'->'prompts') prompt
      where not exists (select 1 from public.coaching_generic_recordings r
        where r.attempt_id=p_attempt and r.prompt_id=prompt->>'id')
        and not exists (select 1 from public.coaching_generic_inherited_recordings i
        where i.attempt_id=p_attempt and i.prompt_id=prompt->>'id'))
      then raise exception 'Required recording missing'; end if;
  end loop;
  update public.coaching_generic_attempts a set completed_stages=
    case when a.completed_stages ? p_stage then a.completed_stages else a.completed_stages || to_jsonb(p_stage) end
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress' returning * into v;
  if v.id is null then raise exception 'Active assigned stage required'; end if;
  return v;
end $$;
create trigger immutable_generic_recording before update or delete on public.coaching_generic_recordings
for each row execute function coaching_private.protect_generic_recording();
create function coaching_private.protect_generic_storage_object() returns trigger
language plpgsql set search_path='' as $$ begin
  if old.bucket_id='coaching-submissions' and exists (
    select 1 from public.coaching_generic_recordings r where r.storage_path=old.name) then
    raise exception 'Referenced recording cannot be deleted or replaced';
  end if;
  return old;
end $$;
create trigger preserve_generic_recording_object before delete or update on storage.objects
for each row execute function coaching_private.protect_generic_storage_object();

create function coaching_private.validate_generic_activity_response(p_activity jsonb,p_response jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare kind text := p_activity->>'type'; field jsonb; item jsonb; group_item jsonb; key text; value text;
  allowed text[] := array[]::text[]; selected jsonb;
begin
  if jsonb_typeof(p_response)<>'object' then return false; end if;
  if kind='text_response' then
    for field in select * from jsonb_array_elements(p_activity->'payload'->'fields') loop
      key:=field->>'id'; value:=p_response->>key;
      allowed:=array_append(allowed,key);
      if jsonb_typeof(p_response->key)<>'string' or length(btrim(value))=0 then return false; end if;
    end loop;
  elsif kind='reflection' then
    for item in select * from jsonb_array_elements(p_activity->'payload'->'items') loop
      key:=item->>'id';
      allowed:=array_append(allowed,key);
      if p_response ? key and p_response->>key not in ('yes','no') then return false; end if;
    end loop;
  elsif kind='choice' then
    for item in select * from jsonb_array_elements(p_activity->'payload'->'items') loop
      for field in select * from jsonb_array_elements(item->'fields') loop
        key:=(item->>'id')||'-'||(field->>'id'); value:=p_response->>key;
        allowed:=array_append(allowed,key);
        if field->>'mode'='single' then
          if jsonb_typeof(p_response->key)<>'string' or not exists (
            select 1 from jsonb_array_elements(field->'options') o where o->>'id'=value) then return false; end if;
        elsif field->>'mode'='multi' then
          selected:=p_response->key;
          if jsonb_typeof(selected)<>'array' or jsonb_array_length(selected)=0
            or (select count(distinct answer) from jsonb_array_elements_text(selected) answer)<>jsonb_array_length(selected)
            or exists(select 1 from jsonb_array_elements_text(selected) answer
              where not exists(select 1 from jsonb_array_elements(field->'options') o where o->>'id'=answer))
            then return false; end if;
        else return false; end if;
      end loop;
    end loop;
  elsif kind='matching' then
    for item in select * from jsonb_array_elements(p_activity->'payload'->'prompts') loop
      for group_item in select * from jsonb_array_elements(p_activity->'payload'->'groups') loop
        key:=(item->>'id')||'-'||(group_item->>'id'); value:=p_response->>key;
        allowed:=array_append(allowed,key);
        if jsonb_typeof(p_response->key)<>'string' or not exists (
          select 1 from jsonb_array_elements(group_item->'options') o where o->>'id'=value) then return false; end if;
      end loop;
    end loop;
  else return false; end if;
  if exists(select 1 from jsonb_object_keys(p_response) supplied where not (supplied=any(allowed))) then return false; end if;
  return true;
end $$;

create function public.submit_generic_coaching_verify_atomic(p_attempt uuid,p_text_response text,p_request_key uuid)
returns public.coaching_generic_attempts language plpgsql security definer set search_path='' as $$
declare v_attempt public.coaching_generic_attempts; v_submission public.coaching_submissions;
  v_revision uuid; v_existing uuid;
begin
  if auth.uid() is null or p_request_key is null or length(btrim(coalesce(p_text_response,'')))=0 then
    raise exception 'Authenticated submission, text and request key required'; end if;
  select * into v_attempt from public.coaching_generic_attempts a
    where a.id=p_attempt and a.student_id=auth.uid() for update;
  if v_attempt.id is null then raise exception 'Own attempt required'; end if;
  select s.request_key into v_existing from public.coaching_generic_submissions s where s.attempt_id=p_attempt;
  if v_existing is not null then
    if v_existing=p_request_key and exists(select 1 from public.coaching_generic_submissions s
      join public.coaching_submission_revisions r on r.id=s.submission_revision_id
      where s.attempt_id=p_attempt and r.text_response=p_text_response) then return v_attempt; end if;
    raise exception 'Attempt already submitted with different request key';
  end if;
  if v_attempt.status<>'in_progress' then raise exception 'Active attempt required'; end if;
  select * into v_submission from public.coaching_submissions s
    where s.task_id=v_attempt.task_id and s.student_id=auth.uid() order by s.created_at desc limit 1 for update;
  if v_submission.id is null then
    insert into public.coaching_submissions(task_id,student_id,text_response,status,submitted_at)
      values(v_attempt.task_id,auth.uid(),p_text_response,'submitted',now()) returning * into v_submission;
  else
    v_submission:=public.update_own_coaching_submission(v_submission.id,p_text_response,null,null,true);
  end if;
  select r.id into v_revision from public.coaching_submission_revisions r
    where r.submission_id=v_submission.id order by r.revision_number desc limit 1;
  if v_revision is null then raise exception 'Submission revision missing'; end if;
  v_attempt:=public.submit_generic_coaching_verify(p_attempt,v_revision);
  update public.coaching_generic_submissions s set request_key=p_request_key where s.attempt_id=p_attempt;
  return v_attempt;
end $$;
revoke all on function public.submit_generic_coaching_verify_atomic(uuid,text,uuid) from public,anon;
grant execute on function public.submit_generic_coaching_verify_atomic(uuid,text,uuid) to authenticated;

create or replace function public.save_generic_coaching_recording(p_attempt uuid,p_prompt text,p_path text,p_seconds integer)
returns public.coaching_generic_recordings language plpgsql security definer set search_path='' as $$
declare v public.coaching_generic_recordings; v_key text; v_version integer; v_min integer; v_max integer;
begin
  perform 1 from public.coaching_generic_attempts a where a.id=p_attempt and a.student_id=auth.uid() for update;
  select a.module_key,a.content_version into v_key,v_version from public.coaching_generic_attempts a
    join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress'
      and p_path ~ ('^'||a.student_id::text||'/'||a.task_id::text||'/'||a.id::text||'/[a-zA-Z0-9_-]+[.]webm$')
      and exists(select 1 from storage.objects o where o.bucket_id='coaching-submissions' and o.name=p_path)
      and exists(select 1 from jsonb_array_elements(m.manifest->'stages') s,
        jsonb_array_elements(s->'activities') activity,
        jsonb_array_elements(case when activity->>'type'='recording' then activity->'payload'->'prompts' else '[]'::jsonb end) prompt
        where prompt->>'id'=p_prompt);
  if v_key is null or p_seconds not between 1 and 600 then raise exception 'Active assigned recording required'; end if;
  select r.min_seconds,r.max_seconds into v_min,v_max from public.coaching_generic_recording_rules r
    where r.module_key=v_key and r.content_version=v_version and r.prompt_id=p_prompt;
  if v_min is not null and p_seconds not between v_min and v_max then raise exception 'Recording duration outside approved range'; end if;
  insert into public.coaching_generic_recordings(attempt_id,prompt_id,storage_path,duration_seconds)
    values(p_attempt,p_prompt,p_path,p_seconds) returning * into v;
  return v;
end $$;

create table public.coaching_generic_inherited_recordings (
  attempt_id uuid not null references public.coaching_generic_attempts(id),
  prompt_id text not null,
  recording_id uuid not null references public.coaching_generic_recordings(id),
  primary key(attempt_id,prompt_id)
);
alter table public.coaching_generic_inherited_recordings enable row level security;
revoke all on public.coaching_generic_inherited_recordings from public,anon,authenticated;
grant select on public.coaching_generic_inherited_recordings to authenticated;
create policy "inherited recording readers" on public.coaching_generic_inherited_recordings for select to authenticated
using (exists(select 1 from public.coaching_generic_attempts a where a.id=coaching_generic_inherited_recordings.attempt_id));

create or replace function public.start_generic_coaching_attempt(p_task uuid) returns public.coaching_generic_attempts
language plpgsql security definer set search_path='' as $$
declare v public.coaching_generic_attempts; prior public.coaching_generic_attempts; v_key text; v_version integer;
begin
  if auth.uid() is null or public.get_user_role()<>'student' then raise exception 'Student required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_task::text,0));
  select a.module_key,a.content_version into v_key,v_version from public.coaching_generic_task_assignments a
    join public.coaching_tasks t on t.id=a.task_id join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
    join public.coaching_enrollments e on e.id=w.enrollment_id
    where a.task_id=p_task and e.student_id=auth.uid();
  if v_key is null then raise exception 'Assigned module required'; end if;
  select * into prior from public.coaching_generic_attempts a
    where a.task_id=p_task and a.student_id=auth.uid() order by a.attempt_number desc limit 1;
  if prior.status='in_progress' then return prior; end if;
  if prior.status='awaiting_review' or prior.status='completed' then raise exception 'No revision prescribed'; end if;
  insert into public.coaching_generic_attempts(task_id,student_id,attempt_number,module_key,content_version)
    values(p_task,auth.uid(),coalesce(prior.attempt_number+1,1),v_key,v_version) returning * into v;
  if prior.status='revision_required' then
    insert into public.coaching_generic_inherited_recordings(attempt_id,prompt_id,recording_id)
      select v.id,accepted.prompt_id,accepted.recording_id from (
        select r.prompt_id,r.id as recording_id from public.coaching_generic_recordings r where r.attempt_id=prior.id
        union all
        select i.prompt_id,i.recording_id from public.coaching_generic_inherited_recordings i where i.attempt_id=prior.id
      ) accepted
      join public.coaching_generic_reviews review on review.attempt_id=prior.id
      where review.review_data->'passedItems' ? accepted.prompt_id
        and not (review.review_data->'repeatedItems' ? accepted.prompt_id)
      on conflict do nothing;
  end if;
  return v;
end $$;

create or replace function public.submit_generic_coaching_verify(p_attempt uuid,p_submission_revision uuid)
returns public.coaching_generic_attempts language plpgsql security definer set search_path='' as $$
declare v public.coaching_generic_attempts; v_manifest jsonb; v_policy jsonb;
begin
  select m.manifest,m.manifest->'verifyPolicy' into v_manifest,v_policy
    from public.coaching_generic_attempts a join public.coaching_generic_module_versions m
      on m.module_key=a.module_key and m.content_version=a.content_version
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress';
  if v_manifest is null or exists(select 1 from jsonb_array_elements(v_manifest->'stages') s
    where s->>'id'<>'Verify' and not exists(select 1 from public.coaching_generic_attempts a
      where a.id=p_attempt and a.completed_stages ? (s->>'id'))) then raise exception 'Complete required stages before Verify'; end if;
  if v_policy->>'kind'='rubric_sum' then
    if not exists(select 1 from public.coaching_generic_recordings r
      where r.attempt_id=p_attempt and exists(select 1 from jsonb_array_elements(v_manifest->'stages') s,
        jsonb_array_elements(s->'activities') activity,
        jsonb_array_elements(case when activity->>'type'='recording' then activity->'payload'->'prompts' else '[]'::jsonb end) prompt
        where s->>'id'='Verify' and prompt->>'id'=r.prompt_id)) then raise exception 'Fresh Verify recording required'; end if;
  elsif v_policy->>'kind'='per_item_pass' then
    if exists(select 1 from jsonb_array_elements_text(v_policy->'itemIds') required
      where not exists(select 1 from public.coaching_generic_recordings r where r.attempt_id=p_attempt and r.prompt_id=required)
        and not exists(select 1 from public.coaching_generic_inherited_recordings i where i.attempt_id=p_attempt and i.prompt_id=required))
      then raise exception 'All Apply recordings required'; end if;
  else raise exception 'Unknown Verify policy'; end if;
  update public.coaching_generic_attempts a set status='awaiting_review',submitted_at=now()
    where a.id=p_attempt and a.student_id=auth.uid() and a.status='in_progress'
    and exists(select 1 from public.coaching_submission_revisions r where r.id=p_submission_revision
      and r.task_id=a.task_id and r.student_id=a.student_id) returning * into v;
  if v.id is null then raise exception 'Own submitted revision and active attempt required'; end if;
  insert into public.coaching_generic_submissions(attempt_id,submission_revision_id) values(v.id,p_submission_revision);
  return v;
end $$;

create or replace function public.review_generic_coaching_verify(p_attempt uuid,p_review jsonb)
returns public.coaching_generic_reviews language plpgsql security definer set search_path='' as $$
declare v public.coaching_generic_reviews; v_policy jsonb; v_pass boolean; v_sum integer;
  reviewed jsonb; passed jsonb; repeated jsonb;
begin
  if auth.uid() is null or public.get_user_role()<>'teacher' then raise exception 'Assigned coach required'; end if;
  select m.manifest->'verifyPolicy' into v_policy from public.coaching_generic_attempts a
    join public.coaching_generic_module_versions m on m.module_key=a.module_key and m.content_version=a.content_version
    join public.coaching_tasks t on t.id=a.task_id join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
    join public.coaching_enrollments e on e.id=w.enrollment_id
    where a.id=p_attempt and a.status='awaiting_review' and e.coach_id=auth.uid() for update of a;
  if v_policy is null then raise exception 'Assigned pending attempt required'; end if;
  if v_policy->>'kind'='rubric_sum' then
    if jsonb_typeof(p_review->'scores')<>'array'
      or jsonb_array_length(p_review->'scores')<>jsonb_array_length(v_policy->'criteria')
      or exists(select 1 from jsonb_array_elements(p_review->'scores') score
        where jsonb_typeof(score)<>'number' or score::text !~ '^[0-2]$')
      then raise exception 'Complete rubric scores from 0 to 2 required'; end if;
    select sum(score::text::integer) into v_sum from jsonb_array_elements(p_review->'scores') score;
    v_pass:=v_sum>=(v_policy->>'minTotal')::integer and
      (not (v_policy->>'noZero')::boolean or not exists(select 1 from jsonb_array_elements(p_review->'scores') score where score::text='0'));
  elsif v_policy->>'kind'='per_item_pass' then
    reviewed:=p_review->'reviewedItems'; passed:=p_review->'passedItems'; repeated:=p_review->'repeatedItems';
    if jsonb_typeof(reviewed)<>'array' or jsonb_typeof(passed)<>'array' or jsonb_typeof(repeated)<>'array'
      or jsonb_array_length(reviewed)<>jsonb_array_length(v_policy->'itemIds')
      or exists(select 1 from jsonb_array_elements_text(reviewed) item where not (v_policy->'itemIds' ? item))
      or (select count(distinct item) from jsonb_array_elements_text(reviewed) item)<>jsonb_array_length(reviewed)
      or exists(select 1 from jsonb_array_elements_text(passed) item where not (reviewed ? item))
      or exists(select 1 from jsonb_array_elements_text(repeated) item where not (reviewed ? item))
      then raise exception 'Complete unique per-item review required'; end if;
    v_pass:=(select count(distinct item) from jsonb_array_elements_text(passed) item)>=(v_policy->>'minPass')::integer
      and (not (v_policy->>'noQuestionRepeat')::boolean or jsonb_array_length(repeated)=0);
  else raise exception 'Unknown Verify policy'; end if;
  insert into public.coaching_generic_reviews(attempt_id,reviewed_by,review_data,passed)
    values(p_attempt,auth.uid(),p_review,v_pass) returning * into v;
  update public.coaching_generic_attempts a set status=case when v_pass then 'completed' else 'revision_required' end
    where a.id=p_attempt;
  return v;
end $$;
