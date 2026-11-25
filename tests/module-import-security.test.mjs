import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract tests that run without Supabase credentials or production access.
// Integration tests must additionally exercise actual RLS in an isolated project.
const endpoint = readFileSync(new URL('../supabase/functions/ielts-import-draft/index.ts', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../docs/sql/ielts_module_drafts_ISOLATED_REVIEW_ONLY.sql', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/pages/AdminModules.tsx', import.meta.url), 'utf8');

test('draft endpoint authenticates caller and checks trusted admin role', () => {
  assert.match(endpoint, /auth\.getUser\(/);
  assert.match(endpoint, /from\('profiles'\).*select\('role'\)/);
  assert.match(endpoint, /profile\?\.role !== 'admin'/);
  assert.match(endpoint, /Authorization: auth/);
  assert.doesNotMatch(endpoint, /SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|user_metadata/);
});

test('draft endpoint cannot publish or write to student module table', () => {
  assert.match(endpoint, /from\('ielts_module_drafts'\)\.insert/);
  assert.doesNotMatch(endpoint, /from\('learning_modules'\)/);
  assert.doesNotMatch(endpoint, /is_published\s*:/);
});

test('draft SQL is admin-only and immutable via Data API', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /for insert to authenticated/);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(sql, /p\.role = 'admin'/);
  assert.doesNotMatch(sql, /for update to authenticated|for delete to authenticated/i);
});

test('import UI explicitly keeps preview separate from persistence', () => {
  assert.match(ui, /parseModuleDraft\(draftJson\)/);
  assert.match(ui, /chưa lưu database/);
  assert.doesNotMatch(ui, /\.from\('ielts_module_drafts'\)\.insert/);
});
