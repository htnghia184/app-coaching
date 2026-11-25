-- PROPOSAL: shared E-Master Auth/profile security fix. Review before production use.
-- Tested only against the isolated Supabase Local baseline.
-- Keeps service_role/postgres grants and existing coaching/assessment RLS policies.
-- Apply with ON_ERROR_STOP=1 in one transaction.

-- Preflight: production must already have the exact enabled Auth signup trigger.
-- A public-only Local baseline may have no trigger; any existing drift aborts.
do $$
declare v_trigger record;
begin
  select tgfoid, tgtype, tgenabled, tgnargs, tgqual, tgisinternal, tgconstraint
    into v_trigger
  from pg_catalog.pg_trigger
  where tgrelid = 'auth.users'::pg_catalog.regclass
    and tgname = 'on_auth_user_created';
  if found and (
    v_trigger.tgfoid <> 'public.handle_new_user()'::pg_catalog.regprocedure or
    v_trigger.tgtype <> 5 or -- AFTER INSERT FOR EACH ROW
    v_trigger.tgenabled <> 'O' or
    v_trigger.tgnargs <> 0 or
    v_trigger.tgqual is not null or -- no WHEN clause
    v_trigger.tgisinternal or
    v_trigger.tgconstraint <> 0
  ) then
    raise exception 'Unexpected on_auth_user_created trigger definition';
  end if;
end;
$$;

-- Existing anon/authenticated table grants include UPDATE(role), INSERT, DELETE,
-- TRUNCATE, REFERENCES and TRIGGER. RLS is not a substitute for column grants.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (full_name, avatar_url, phone, bio, certificates, target_score)
  on table public.profiles to authenticated;

-- Restrict the self-edit policy to signed-in users. Column privileges above
-- prevent edits to id, email, role and created_at even for the user's own row.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Signup metadata is user-controlled. Every ordinary signup starts as student.
-- admin_create_user() retains its server-checked admin path and subsequent
-- profile upsert to the requested student/teacher role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name',
          'student'::public.user_role);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Production already has this trigger. Public-only local baselines lack it.
-- The preflight above rejects an existing trigger with any unexpected property.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_trigger
  where tgrelid = 'auth.users'::pg_catalog.regclass
    and tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- Admin RPCs already check the caller's server-side role. Keep authenticated
-- access for the admin UI, but remove anonymous invocation surface.
revoke execute on function public.admin_create_user(text,text,text,text)
  from public, anon;
revoke execute on function public.admin_delete_user(uuid)
  from public, anon;
grant execute on function public.admin_create_user(text,text,text,text),
  public.admin_delete_user(uuid) to authenticated;
