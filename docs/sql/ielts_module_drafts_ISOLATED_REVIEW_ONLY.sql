-- DRAFT ONLY: review against isolated Supabase before moving into a numbered migration.
-- Do not apply to production shared with test.e-master.vn.
create table if not exists public.ielts_module_drafts (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  content_version integer not null check (content_version > 0),
  title text not null,
  manifest jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ielts_module_drafts_unique_version unique (module_key, content_version),
  constraint ielts_module_drafts_object check (jsonb_typeof(manifest) = 'object'),
  constraint ielts_module_drafts_max_size check (octet_length(manifest::text) <= 500000)
);
alter table public.ielts_module_drafts enable row level security;
revoke all on public.ielts_module_drafts from anon;
grant select, insert on public.ielts_module_drafts to authenticated;

-- Authorization uses trusted profiles.role, never user_metadata.
create policy "ielts drafts admin read" on public.ielts_module_drafts
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));
create policy "ielts drafts admin insert" on public.ielts_module_drafts
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    and manifest ->> 'key' = module_key
    and (manifest ->> 'version')::integer = content_version
    and manifest ->> 'title' = title
    and manifest ? 'stages'
    and manifest -> 'stages' = '["Discover","Learn","Practice","Apply","Reflect","Verify"]'::jsonb
    and not (manifest ?| array['answerKey','answer_key','correct','explanation','gradingKey','privateKey'])
    and not jsonb_path_exists(manifest, '$.**.answerKey')
    and not jsonb_path_exists(manifest, '$.**.answer_key')
    and not jsonb_path_exists(manifest, '$.**.correct')
    and not jsonb_path_exists(manifest, '$.**.explanation')
    and not jsonb_path_exists(manifest, '$.**.gradingKey')
    and not jsonb_path_exists(manifest, '$.**.privateKey')
  );
-- No UPDATE/DELETE policies. Version changes must create a new Draft version.
-- No publish operation is provided by this draft.
