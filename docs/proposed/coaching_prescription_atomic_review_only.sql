-- REVIEW ONLY: apply after coaching_core_lo and generic_module_persistence proposals.
-- One existing task resource (optional module) and zero or more independent LOs.
create table coaching_private.coaching_prescription_requests (
  coach_id uuid not null, request_key uuid not null, payload jsonb not null,
  task_id uuid not null references public.coaching_tasks(id),
  primary key(coach_id,request_key)
);
revoke all on coaching_private.coaching_prescription_requests from public,anon,authenticated;

create function public.prescribe_coaching_task_atomic(
  p_plan uuid,p_title text,p_reason text,p_module_key text,p_content_version integer,
  p_targets jsonb,p_minutes integer,p_request_key uuid
) returns public.coaching_tasks language plpgsql security definer set search_path='' as $$
declare v public.coaching_tasks; v_enrollment uuid; v_module uuid; v_payload jsonb; v_previous record; ref jsonb;
begin
  if auth.uid() is null or public.get_user_role()<>'teacher' or p_request_key is null
    or length(btrim(coalesce(p_title,'')))=0 or length(btrim(coalesce(p_reason,'')))=0
    or p_minutes not between 1 and 480 or jsonb_typeof(p_targets)<>'array'
    or (p_module_key is null) <> (p_content_version is null) then
    raise exception 'Valid coach prescription required'; end if;
  v_payload:=jsonb_build_object('plan',p_plan,'title',p_title,'reason',p_reason,
    'moduleKey',p_module_key,'contentVersion',p_content_version,'targets',p_targets,'minutes',p_minutes);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request_key::text,0));
  select r.payload,r.task_id into v_previous from coaching_private.coaching_prescription_requests r
    where r.coach_id=auth.uid() and r.request_key=p_request_key;
  if found then
    if v_previous.payload<>v_payload then raise exception 'Request key reused with different prescription'; end if;
    select * into v from public.coaching_tasks t where t.id=v_previous.task_id;
    return v;
  end if;
  select w.enrollment_id into v_enrollment from public.coaching_weekly_plans w
    join public.coaching_enrollments e on e.id=w.enrollment_id
    where w.id=p_plan and e.coach_id=auth.uid() and w.status='active';
  if v_enrollment is null then raise exception 'Assigned active weekly plan required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
  if p_module_key is not null then
    select m.module_id into v_module from public.coaching_generic_module_versions m
      join public.learning_modules lm on lm.id=m.module_id
      where m.module_key=p_module_key and m.content_version=p_content_version and lm.is_published;
    if v_module is null then raise exception 'Published immutable resource version required'; end if;
  end if;
  if (select count(*) from jsonb_array_elements(p_targets)) <>
     (select count(distinct (item->>'id')||':'||(item->>'version')) from jsonb_array_elements(p_targets) item)
    then raise exception 'Duplicate outcome target'; end if;
  for ref in select * from jsonb_array_elements(p_targets) loop
    if jsonb_typeof(ref)<>'object' or (ref->>'version') !~ '^[1-9][0-9]*$'
      or not exists(select 1 from public.coaching_enrollment_outcomes o
        where o.enrollment_id=v_enrollment and o.outcome_id=ref->>'id'
          and o.outcome_version=(ref->>'version')::integer and o.active) then
      raise exception 'Active learner outcome priority required';
    end if;
  end loop;
  insert into public.coaching_tasks(weekly_plan_id,module_id,task_type,title,instructions,sequence,is_required)
    values(p_plan,v_module,case when v_module is null then 'text' else 'lesson' end,
      p_title,p_reason,coalesce((select max(t.sequence)+1 from public.coaching_tasks t where t.weekly_plan_id=p_plan),1),true)
    returning * into v;
  if v_module is not null then
    insert into public.coaching_generic_task_assignments(task_id,module_key,content_version,assigned_by)
      values(v.id,p_module_key,p_content_version,auth.uid());
  end if;
  for ref in select * from jsonb_array_elements(p_targets) loop
    insert into public.coaching_task_outcomes(task_id,outcome_id,outcome_version,evidence_expected)
      values(v.id,ref->>'id',(ref->>'version')::integer,
        case when v_module is null then 'task_submission' else 'module_submission' end);
  end loop;
  insert into public.coaching_work_logs(enrollment_id,coach_id,work_type,minutes,occurred_on,note)
    values(v_enrollment,auth.uid(),'planning',p_minutes,current_date,p_reason);
  insert into coaching_private.coaching_prescription_requests(coach_id,request_key,payload,task_id)
    values(auth.uid(),p_request_key,v_payload,v.id);
  return v;
end $$;
revoke all on function public.prescribe_coaching_task_atomic(uuid,text,text,text,integer,jsonb,integer,uuid) from public,anon;
grant execute on function public.prescribe_coaching_task_atomic(uuid,text,text,text,integer,jsonb,integer,uuid) to authenticated;
