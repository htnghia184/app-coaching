-- REVIEW ONLY. Never run against production without separate approval.
-- Independent of the legacy REE-specific coaching_module_attempts proposal.
-- No content or learner rows are seeded. Validate in a verified isolated environment first.

create table public.coaching_learning_outcomes (
  id text not null,
  version integer not null check (version > 0),
  statement text not null check (length(trim(statement)) > 0),
  success_criteria text not null check (length(trim(success_criteria)) > 0),
  active boolean not null default true,
  primary key (id, version)
);

create table public.coaching_enrollment_outcomes (
  enrollment_id uuid not null references public.coaching_enrollments(id),
  outcome_id text not null,
  outcome_version integer not null,
  priority integer not null check (priority > 0),
  rationale text not null check (length(trim(rationale)) > 0),
  checkpoint_on date,
  active boolean not null default true,
  deactivated_at timestamptz,
  primary key (enrollment_id, outcome_id, outcome_version),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
);

create table public.coaching_task_outcomes (
  task_id uuid not null references public.coaching_tasks(id),
  outcome_id text not null,
  outcome_version integer not null,
  evidence_expected text not null check (evidence_expected in ('task_submission','module_submission','live_session_note')),
  primary key (task_id, outcome_id, outcome_version),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
);

create table public.coaching_outcome_evidence (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.coaching_enrollments(id),
  outcome_id text not null,
  outcome_version integer not null,
  source_type text not null check (source_type in ('task_submission','module_submission','live_session_note')),
  submission_revision_id uuid references public.coaching_submission_revisions(id),
  module_id uuid references public.learning_modules(id),
  module_content_version integer check (module_content_version > 0),
  live_session_id uuid references public.coaching_sessions(id),
  summary text not null check (length(trim(summary)) > 0),
  captured_at timestamptz not null default now(),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version),
  check (
    (source_type = 'task_submission' and submission_revision_id is not null and module_id is null and module_content_version is null and live_session_id is null)
    or (source_type = 'module_submission' and submission_revision_id is not null and module_id is not null and module_content_version is not null and live_session_id is null)
    or (source_type = 'live_session_note' and live_session_id is not null and submission_revision_id is null and module_id is null and module_content_version is null)
  )
);

create table public.coaching_outcome_assessments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.coaching_enrollments(id),
  outcome_id text not null,
  outcome_version integer not null,
  status text not null check (status in ('not_assessed','emerging','developing','demonstrated','needs_recheck')),
  rationale text not null check (length(trim(rationale)) > 0),
  feedback text not null check (length(trim(feedback)) > 0),
  assessed_by uuid not null references public.profiles(id),
  assessed_at timestamptz not null default now(),
  foreign key (outcome_id, outcome_version) references public.coaching_learning_outcomes(id, version)
);

create table public.coaching_assessment_evidence (
  assessment_id uuid not null references public.coaching_outcome_assessments(id) on delete restrict,
  evidence_id uuid not null references public.coaching_outcome_evidence(id) on delete restrict,
  primary key (assessment_id, evidence_id)
);

create table public.coaching_work_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.coaching_enrollments(id),
  coach_id uuid not null references public.profiles(id),
  work_type text not null check (work_type in ('planning','review','live_session','follow_up')),
  minutes integer not null check (minutes between 1 and 480),
  occurred_on date not null,
  note text
);

alter table public.coaching_learning_outcomes enable row level security;
alter table public.coaching_enrollment_outcomes enable row level security;
alter table public.coaching_task_outcomes enable row level security;
alter table public.coaching_outcome_evidence enable row level security;
alter table public.coaching_outcome_assessments enable row level security;
alter table public.coaching_assessment_evidence enable row level security;
alter table public.coaching_work_logs enable row level security;

revoke all on public.coaching_learning_outcomes, public.coaching_enrollment_outcomes,
  public.coaching_task_outcomes, public.coaching_outcome_evidence,
  public.coaching_outcome_assessments, public.coaching_assessment_evidence,
  public.coaching_work_logs from public, anon, authenticated;
grant select on public.coaching_learning_outcomes, public.coaching_enrollment_outcomes,
  public.coaching_task_outcomes, public.coaching_outcome_evidence,
  public.coaching_outcome_assessments, public.coaching_assessment_evidence,
  public.coaching_work_logs to authenticated;

create policy "authenticated outcome catalog" on public.coaching_learning_outcomes
  for select to authenticated using (auth.uid() is not null);

-- Read access follows enrollment ownership. Direct writes remain revoked.
create policy "enrollment outcome readers" on public.coaching_enrollment_outcomes
  for select to authenticated using (exists (
    select 1 from public.coaching_enrollments e where e.id = enrollment_id
      and (e.student_id = (select auth.uid()) or e.coach_id = (select auth.uid())
        or public.get_user_role() = 'admin')
  ));
create policy "task outcome readers" on public.coaching_task_outcomes
  for select to authenticated using (exists (
    select 1 from public.coaching_tasks t
    join public.coaching_weekly_plans p on p.id = t.weekly_plan_id
    join public.coaching_enrollments e on e.id = p.enrollment_id
    where t.id = task_id and (e.student_id = (select auth.uid())
      or e.coach_id = (select auth.uid()) or public.get_user_role() = 'admin')
  ));
create policy "evidence readers" on public.coaching_outcome_evidence
  for select to authenticated using (exists (
    select 1 from public.coaching_enrollments e where e.id = enrollment_id
      and (e.student_id = (select auth.uid()) or e.coach_id = (select auth.uid())
        or public.get_user_role() = 'admin')
  ));
create policy "assessment readers" on public.coaching_outcome_assessments
  for select to authenticated using (exists (
    select 1 from public.coaching_enrollments e where e.id = enrollment_id
      and (e.student_id = (select auth.uid()) or e.coach_id = (select auth.uid())
        or public.get_user_role() = 'admin')
  ));
create policy "assessment evidence readers" on public.coaching_assessment_evidence
  for select to authenticated using (exists (
    select 1 from public.coaching_outcome_assessments a where a.id = assessment_id
  ));
create policy "work log coach readers" on public.coaching_work_logs
  for select to authenticated using (coach_id = (select auth.uid()) or public.get_user_role() = 'admin');

-- All mutations are narrowly checked RPCs. This helper checks the source's actual
-- enrollment, preventing a caller from attaching another learner's evidence.
create schema if not exists coaching_private;
revoke all on schema coaching_private from public, anon, authenticated;
create function coaching_private.valid_outcome_source(
  p_enrollment uuid, p_source_type text, p_revision uuid,
  p_module uuid, p_module_version integer, p_session uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_source_type = 'task_submission' then exists (
      select 1 from public.coaching_submission_revisions r
      join public.coaching_tasks t on t.id = r.task_id
      join public.coaching_weekly_plans w on w.id = t.weekly_plan_id
      join public.coaching_enrollments e on e.id = w.enrollment_id
      where r.id = p_revision and t.module_id is null and e.id = p_enrollment and e.student_id = r.student_id)
    when p_source_type = 'module_submission' then exists (
      select 1 from public.coaching_submission_revisions r
      join public.coaching_tasks t on t.id = r.task_id
      join public.coaching_weekly_plans w on w.id = t.weekly_plan_id
      join public.coaching_enrollments e on e.id = w.enrollment_id
      join public.learning_modules m on m.id = t.module_id
      where r.id = p_revision and e.id = p_enrollment and e.student_id = r.student_id
        and t.module_id = p_module and m.is_published
        and (m.content->>'contentVersion') ~ '^[0-9]+$'
        and (m.content->>'contentVersion')::integer = p_module_version)
    when p_source_type = 'live_session_note' then exists (
      select 1 from public.coaching_sessions s
      join public.coaching_enrollments e on e.id = s.enrollment_id
      where s.id = p_session and e.id = p_enrollment and e.coach_id = s.coach_id
        and s.summary is not null and length(trim(s.summary)) > 0)
    else false end
$$;
revoke all on function coaching_private.valid_outcome_source(uuid,text,uuid,uuid,integer,uuid) from public, anon, authenticated;

create function public.record_coaching_outcome_evidence(
  p_enrollment uuid, p_outcome text, p_version integer, p_revision uuid,
  p_source_type text, p_module uuid, p_module_version integer, p_session uuid, p_summary text
) returns public.coaching_outcome_evidence
language plpgsql security definer set search_path = ''
as $$
declare v public.coaching_outcome_evidence;
begin
  if auth.uid() is null or public.get_user_role() <> 'teacher'
    or not exists (select 1 from public.coaching_enrollments e
                   where e.id = p_enrollment and e.coach_id = auth.uid()) then
    raise exception 'Assigned coach required';
  end if;
  if not exists (select 1 from public.coaching_enrollment_outcomes o
      where o.enrollment_id = p_enrollment and o.outcome_id = p_outcome and o.outcome_version = p_version and o.active)
    or not coaching_private.valid_outcome_source(p_enrollment,p_source_type,p_revision,p_module,p_module_version,p_session) then
    raise exception 'Invalid outcome or evidence source';
  end if;
  insert into public.coaching_outcome_evidence
    (enrollment_id,outcome_id,outcome_version,source_type,submission_revision_id,module_id,module_content_version,live_session_id,summary)
  values (p_enrollment,p_outcome,p_version,p_source_type,p_revision,p_module,p_module_version,p_session,p_summary)
  returning * into v;
  return v;
end $$;
revoke all on function public.record_coaching_outcome_evidence(uuid,text,integer,uuid,text,uuid,integer,uuid,text) from public, anon;
grant execute on function public.record_coaching_outcome_evidence(uuid,text,integer,uuid,text,uuid,integer,uuid,text) to authenticated;

create function public.record_coaching_outcome_assessment(
  p_enrollment uuid, p_outcome text, p_version integer, p_status text,
  p_rationale text, p_feedback text, p_evidence_ids uuid[]
) returns public.coaching_outcome_assessments
language plpgsql security definer set search_path = ''
as $$
declare v public.coaching_outcome_assessments;
begin
  if auth.uid() is null or public.get_user_role() <> 'teacher'
    or not exists (select 1 from public.coaching_enrollments e
                   where e.id = p_enrollment and e.coach_id = auth.uid()) then
    raise exception 'Assigned coach required';
  end if;
  if coalesce(array_length(p_evidence_ids,1),0) = 0
    or (select count(*) from unnest(p_evidence_ids) x) <>
       (select count(distinct x) from unnest(p_evidence_ids) x)
    or (select count(*) from public.coaching_outcome_evidence e
        where e.id = any(p_evidence_ids) and e.enrollment_id = p_enrollment
          and e.outcome_id = p_outcome and e.outcome_version = p_version)
       <> array_length(p_evidence_ids,1) then
    raise exception 'Evidence must belong to this learner and outcome';
  end if;
  insert into public.coaching_outcome_assessments
    (enrollment_id,outcome_id,outcome_version,status,rationale,feedback,assessed_by)
  values (p_enrollment,p_outcome,p_version,p_status,p_rationale,p_feedback,auth.uid())
  returning * into v;
  insert into public.coaching_assessment_evidence(assessment_id,evidence_id)
  select v.id,x from unnest(p_evidence_ids) x;
  return v;
end $$;
revoke all on function public.record_coaching_outcome_assessment(uuid,text,integer,text,text,text,uuid[]) from public, anon;
grant execute on function public.record_coaching_outcome_assessment(uuid,text,integer,text,text,text,uuid[]) to authenticated;

create function public.set_coaching_outcome_priority(
  p_enrollment uuid, p_outcome text, p_version integer,
  p_priority integer, p_rationale text, p_checkpoint date
) returns public.coaching_enrollment_outcomes
language plpgsql security definer set search_path = ''
as $$
declare v public.coaching_enrollment_outcomes;
begin
  if auth.uid() is null or public.get_user_role() <> 'teacher'
    or not exists (select 1 from public.coaching_enrollments e
                   where e.id = p_enrollment and e.coach_id = auth.uid()) then
    raise exception 'Assigned coach required';
  end if;
  insert into public.coaching_enrollment_outcomes
    (enrollment_id,outcome_id,outcome_version,priority,rationale,checkpoint_on)
  values (p_enrollment,p_outcome,p_version,p_priority,p_rationale,p_checkpoint)
  on conflict (enrollment_id,outcome_id,outcome_version) do update
    set priority = excluded.priority, rationale = excluded.rationale,
        checkpoint_on = excluded.checkpoint_on, active = true, deactivated_at = null
  returning * into v;
  return v;
end $$;
revoke all on function public.set_coaching_outcome_priority(uuid,text,integer,integer,text,date) from public, anon;
grant execute on function public.set_coaching_outcome_priority(uuid,text,integer,integer,text,date) to authenticated;

create function public.deactivate_coaching_outcome_priority(
  p_enrollment uuid, p_outcome text, p_version integer
) returns public.coaching_enrollment_outcomes
language plpgsql security definer set search_path = ''
as $$
declare v public.coaching_enrollment_outcomes;
begin
  if auth.uid() is null or public.get_user_role() <> 'teacher'
    or not exists (select 1 from public.coaching_enrollments e
                   where e.id = p_enrollment and e.coach_id = auth.uid()) then
    raise exception 'Assigned coach required';
  end if;
  update public.coaching_enrollment_outcomes
    set active = false, deactivated_at = now()
    where enrollment_id = p_enrollment and outcome_id = p_outcome and outcome_version = p_version
    returning * into v;
  if v.enrollment_id is null then raise exception 'Outcome priority not found'; end if;
  return v;
end $$;
revoke all on function public.deactivate_coaching_outcome_priority(uuid,text,integer) from public, anon;
grant execute on function public.deactivate_coaching_outcome_priority(uuid,text,integer) to authenticated;

create function public.link_coaching_task_outcome(
  p_task uuid, p_outcome text, p_version integer, p_evidence_expected text
) returns public.coaching_task_outcomes
language plpgsql security definer set search_path = ''
as $$
declare v public.coaching_task_outcomes; v_enrollment uuid;
begin
  if auth.uid() is null or public.get_user_role() <> 'teacher' then
    raise exception 'Coach required';
  end if;
  select e.id into v_enrollment from public.coaching_tasks t
    join public.coaching_weekly_plans w on w.id = t.weekly_plan_id
    join public.coaching_enrollments e on e.id = w.enrollment_id
    where t.id = p_task and e.coach_id = auth.uid();
  if v_enrollment is null or not exists (
    select 1 from public.coaching_enrollment_outcomes o
    where o.enrollment_id = v_enrollment and o.outcome_id = p_outcome
      and o.outcome_version = p_version and o.active
  ) then raise exception 'Assigned task and selected outcome required'; end if;
  insert into public.coaching_task_outcomes(task_id,outcome_id,outcome_version,evidence_expected)
    values(p_task,p_outcome,p_version,p_evidence_expected)
  on conflict (task_id,outcome_id,outcome_version) do update
    set evidence_expected = excluded.evidence_expected returning * into v;
  return v;
end $$;
revoke all on function public.link_coaching_task_outcome(uuid,text,integer,text) from public, anon;
grant execute on function public.link_coaching_task_outcome(uuid,text,integer,text) to authenticated;

create function public.record_coaching_work(
  p_enrollment uuid, p_type text, p_minutes integer, p_day date, p_note text
) returns public.coaching_work_logs
language plpgsql security definer set search_path = ''
as $$
declare v public.coaching_work_logs;
begin
  if auth.uid() is null or public.get_user_role() <> 'teacher'
    or not exists (select 1 from public.coaching_enrollments e
                   where e.id = p_enrollment and e.coach_id = auth.uid()) then
    raise exception 'Assigned coach required';
  end if;
  insert into public.coaching_work_logs(enrollment_id,coach_id,work_type,minutes,occurred_on,note)
    values(p_enrollment,auth.uid(),p_type,p_minutes,p_day,p_note)
    returning * into v;
  return v;
end $$;
revoke all on function public.record_coaching_work(uuid,text,integer,date,text) from public, anon;
grant execute on function public.record_coaching_work(uuid,text,integer,date,text) to authenticated;

-- Before approval: isolated tests must cover student, assigned/unassigned coach,
-- admin, anonymous users, cross-enrollment sources, duplicate evidence,
-- reassessment history and failed/rolled-back RPCs. No production execution.
