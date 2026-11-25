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
-- Supabase default privileges may grant writes to API roles. Clear them first.
revoke all on public.ielts_module_drafts from public, anon, authenticated;
grant select, insert on public.ielts_module_drafts to authenticated;

-- Data API inserts bypass the Edge Function; validate their public payload too.
create or replace function public.ielts_draft_manifest_safe(node jsonb, depth integer)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare item record;
begin
  if depth < 0 or depth > 40 then return false; end if;
  if pg_catalog.jsonb_typeof(node) = 'object' then
    for item in select key, value from pg_catalog.jsonb_each(node) loop
      if pg_catalog.lower(item.key) = any(array[
        'answerkey','answer_key','correct','explanation','gradingkey','privatekey','iscorrect'
      ]) or not public.ielts_draft_manifest_safe(item.value, depth + 1) then return false; end if;
    end loop;
  elsif pg_catalog.jsonb_typeof(node) = 'array' then
    for item in select value from pg_catalog.jsonb_array_elements(node) loop
      if not public.ielts_draft_manifest_safe(item.value, depth + 1) then return false; end if;
    end loop;
  end if;
  return true;
end $$;
revoke all on function public.ielts_draft_manifest_safe(jsonb,integer) from public, anon;
grant execute on function public.ielts_draft_manifest_safe(jsonb,integer) to authenticated;

create or replace function public.ielts_draft_shape_valid(m jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(m) = 'object'
    and pg_catalog.jsonb_typeof(m->'version') = 'number'
    and m->>'version' ~ '^[1-9][0-9]*$'
    and pg_catalog.jsonb_typeof(m->'minutes') = 'number'
    and (m->>'minutes')::numeric > 0
    and pg_catalog.jsonb_typeof(m->'stages') = 'array'
    and m->'stages' = '["Discover","Learn","Practice","Apply","Reflect","Verify"]'::jsonb
    and pg_catalog.jsonb_typeof(m->'source') = 'object'
    and nullif(pg_catalog.btrim(m->'source'->>'url'),'') is not null
    and pg_catalog.jsonb_typeof(m->'stageMinutes') = 'object'
    and pg_catalog.jsonb_typeof(m->'learn') = 'object'
    and pg_catalog.jsonb_typeof(m->'practice') = 'object'
    and pg_catalog.jsonb_typeof(m->'apply') = 'object'
    and pg_catalog.jsonb_typeof(m->'reflect') = 'object'
    and pg_catalog.jsonb_typeof(m->'verify') = 'object'
    and pg_catalog.jsonb_typeof(m->'mastery') = 'object'
    and pg_catalog.jsonb_typeof(m->'prerequisites') = 'array'
    and pg_catalog.jsonb_typeof(m->'rubric') = 'array'
    and pg_catalog.jsonb_typeof(m->'assets') = 'array'
    and pg_catalog.jsonb_typeof(m->'missingAssets') = 'array'
    and m->'verify'->>'prompt' = m->>'discoverPrompt'
    and public.ielts_draft_manifest_safe(m, 0)
$$;
revoke all on function public.ielts_draft_shape_valid(jsonb) from public, anon;
grant execute on function public.ielts_draft_shape_valid(jsonb) to authenticated;

-- Authorization uses trusted profiles.role, never user_metadata.
drop policy if exists "ielts drafts admin read" on public.ielts_module_drafts;
create policy "ielts drafts admin read" on public.ielts_module_drafts
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));
drop policy if exists "ielts drafts admin insert" on public.ielts_module_drafts;
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
    and public.ielts_draft_shape_valid(manifest)
    and manifest ? 'stages'
    and manifest -> 'stages' = '["Discover","Learn","Practice","Apply","Reflect","Verify"]'::jsonb
    and not (manifest ?| array['answerKey','answer_key','correct','explanation','gradingKey','privateKey','isCorrect'])
    and not jsonb_path_exists(manifest, '$.**.answerKey')
    and not jsonb_path_exists(manifest, '$.**.answer_key')
    and not jsonb_path_exists(manifest, '$.**.correct')
    and not jsonb_path_exists(manifest, '$.**.explanation')
    and not jsonb_path_exists(manifest, '$.**.gradingKey')
    and not jsonb_path_exists(manifest, '$.**.privateKey')
    and not jsonb_path_exists(manifest, '$.**.isCorrect')
  );
-- No UPDATE/DELETE policies. Version changes must create a new Draft version.
-- No publish operation is provided by this draft.
