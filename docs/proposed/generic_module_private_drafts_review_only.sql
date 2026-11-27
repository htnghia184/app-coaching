-- REVIEW ONLY. Apply only to verified Supabase Local until independently approved.
-- Private source data is imported separately and never checked into Git.
create table public.coaching_generic_module_drafts (
  module_key text not null,
  content_version integer not null check (content_version > 0),
  manifest jsonb not null,
  source_ref text not null,
  imported_at timestamptz not null default now(),
  primary key (module_key, content_version),
  check (manifest->>'moduleId' = module_key and (manifest->>'contentVersion')::integer = content_version)
);
create table coaching_private.generic_module_draft_assessment (
  module_key text not null,
  content_version integer not null,
  assessment jsonb not null,
  primary key (module_key, content_version),
  foreign key (module_key,content_version) references public.coaching_generic_module_drafts(module_key,content_version)
);
alter table public.coaching_generic_module_drafts enable row level security;
revoke all on public.coaching_generic_module_drafts from public, anon, authenticated;
grant select on public.coaching_generic_module_drafts to authenticated;
create policy "admin reads unpublished module drafts" on public.coaching_generic_module_drafts
  for select to authenticated using (public.get_user_role() = 'admin');
revoke all on coaching_private.generic_module_draft_assessment from public, anon, authenticated;
