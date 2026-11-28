-- REVIEW ONLY: apply after generic module persistence and coaching LO proposals.
-- The immutable v2 manifest is the sole source of module-to-LO links. This
-- security-invoker view makes them queryable without a second mapping table.
create view public.coaching_generic_module_outcomes with (security_invoker=true) as
select v.module_key, v.content_version, ref.value->>'id' as outcome_id,
  (ref.value->>'version')::integer as outcome_version,
  ref.value->>'statement' as outcome_statement
from public.coaching_generic_module_versions v
cross join lateral jsonb_array_elements(case when v.manifest->>'schemaVersion'='2'
  then v.manifest->'outcomes' else '[]'::jsonb end) ref(value)
join public.coaching_learning_outcomes lo on lo.id=ref.value->>'id'
  and lo.version=(ref.value->>'version')::integer;
revoke all on public.coaching_generic_module_outcomes from public,anon,authenticated;
grant select on public.coaching_generic_module_outcomes to authenticated;

create function coaching_private.validate_generic_module_outcomes() returns trigger
language plpgsql security definer set search_path='' as $$
declare ref jsonb;
begin
  if new.manifest->>'schemaVersion'='2' then
    if jsonb_typeof(new.manifest->'outcomes')<>'array' then raise exception 'Versioned outcomes array required'; end if;
    if (select count(*) from jsonb_array_elements(new.manifest->'outcomes')) <>
      (select count(distinct (item->>'id')||':'||(item->>'version')) from jsonb_array_elements(new.manifest->'outcomes') item)
      then raise exception 'Duplicate module outcome reference'; end if;
    for ref in select * from jsonb_array_elements(new.manifest->'outcomes') loop
      if jsonb_typeof(ref)<>'object' or (ref->>'version') !~ '^[1-9][0-9]*$'
        or not exists(select 1 from public.coaching_learning_outcomes lo
          where lo.id=ref->>'id' and lo.version=(ref->>'version')::integer
            and lo.statement=ref->>'statement') then
        raise exception 'Approved versioned LO reference required';
      end if;
    end loop;
  end if;
  return new;
end $$;
create trigger validate_generic_module_outcomes before insert on public.coaching_generic_module_versions
for each row execute function coaching_private.validate_generic_module_outcomes();
