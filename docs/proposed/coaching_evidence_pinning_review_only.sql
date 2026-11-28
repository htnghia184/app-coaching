-- REVIEW ONLY after coaching_core_lo and generic_module_persistence proposals.
-- Preexisting module evidence needs an explicit backfill audit before release.
alter table public.coaching_outcome_evidence add column module_attempt_id uuid
  references public.coaching_generic_attempts(id);

create or replace function coaching_private.valid_outcome_source(
  p_enrollment uuid,p_source_type text,p_revision uuid,
  p_module uuid,p_module_version integer,p_session uuid
) returns boolean language sql stable security definer set search_path='' as $$
  select case
    when p_source_type='task_submission' then exists(
      select 1 from public.coaching_submission_revisions r
      join public.coaching_tasks t on t.id=r.task_id
      join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
      join public.coaching_enrollments e on e.id=w.enrollment_id
      where r.id=p_revision and t.module_id is null and e.id=p_enrollment and e.student_id=r.student_id)
    when p_source_type='module_submission' then exists(
      select 1 from public.coaching_generic_submissions gs
      join public.coaching_generic_attempts a on a.id=gs.attempt_id
      join public.coaching_generic_task_assignments ga on ga.task_id=a.task_id
        and ga.module_key=a.module_key and ga.content_version=a.content_version
      join public.coaching_generic_module_versions mv on mv.module_key=ga.module_key
        and mv.content_version=ga.content_version
      join public.coaching_submission_revisions r on r.id=gs.submission_revision_id
      join public.coaching_tasks t on t.id=a.task_id and t.id=r.task_id and t.module_id=mv.module_id
      join public.coaching_weekly_plans w on w.id=t.weekly_plan_id
      join public.coaching_enrollments e on e.id=w.enrollment_id
      where r.id=p_revision and e.id=p_enrollment and e.student_id=r.student_id
        and a.student_id=r.student_id and a.status in ('awaiting_review','revision_required','completed')
        and mv.module_id=p_module and a.content_version=p_module_version)
    when p_source_type='live_session_note' then exists(
      select 1 from public.coaching_sessions s
      join public.coaching_enrollments e on e.id=s.enrollment_id
      where s.id=p_session and e.id=p_enrollment and e.coach_id=s.coach_id
        and s.summary is not null and length(btrim(s.summary))>0)
    else false end
$$;

create or replace function public.record_coaching_outcome_evidence(
  p_enrollment uuid,p_outcome text,p_version integer,p_revision uuid,
  p_source_type text,p_module uuid,p_module_version integer,p_session uuid,p_summary text
) returns public.coaching_outcome_evidence
language plpgsql security definer set search_path='' as $$
declare v public.coaching_outcome_evidence; v_attempt uuid;
begin
  if auth.uid() is null or public.get_user_role()<>'teacher'
    or not exists(select 1 from public.coaching_enrollments e where e.id=p_enrollment and e.coach_id=auth.uid())
    then raise exception 'Assigned coach required'; end if;
  if not exists(select 1 from public.coaching_enrollment_outcomes o
      where o.enrollment_id=p_enrollment and o.outcome_id=p_outcome and o.outcome_version=p_version and o.active)
    or not coaching_private.valid_outcome_source(p_enrollment,p_source_type,p_revision,p_module,p_module_version,p_session)
    then raise exception 'Invalid outcome or evidence source'; end if;
  if p_source_type in ('task_submission','module_submission') and not exists(
    select 1 from public.coaching_submission_revisions r
    join public.coaching_task_outcomes l on l.task_id=r.task_id
    where r.id=p_revision and l.outcome_id=p_outcome and l.outcome_version=p_version
      and l.evidence_expected=p_source_type) then raise exception 'Task does not target this outcome'; end if;
  if p_source_type='module_submission' then
    select a.id into v_attempt from public.coaching_generic_submissions gs
      join public.coaching_generic_attempts a on a.id=gs.attempt_id
      where gs.submission_revision_id=p_revision and a.content_version=p_module_version;
    if v_attempt is null then raise exception 'Pinned module attempt required'; end if;
  end if;
  insert into public.coaching_outcome_evidence
    (enrollment_id,outcome_id,outcome_version,source_type,submission_revision_id,
      module_id,module_content_version,module_attempt_id,live_session_id,summary)
    values(p_enrollment,p_outcome,p_version,p_source_type,p_revision,p_module,p_module_version,v_attempt,p_session,p_summary)
    returning * into v;
  return v;
end $$;

create function coaching_private.require_pinned_generic_evidence() returns trigger
language plpgsql set search_path='' as $$ begin
  if new.source_type='module_submission' and new.module_attempt_id is null then
    raise exception 'Pinned generic attempt required'; end if;
  return new;
end $$;
create trigger require_pinned_generic_evidence before insert on public.coaching_outcome_evidence
for each row execute function coaching_private.require_pinned_generic_evidence();
