// Unpublished private import. Source files and their values must stay outside Git.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parsePublicModule } from '../src/modules/genericEngine.ts';

const url = process.env.LOCAL_SUPABASE_URL;
const key = process.env.LOCAL_SUPABASE_ANON_KEY;
const password = process.env.LOCAL_PILOT_PASSWORD;
const source = process.env.PRIVATE_CONTENT_DIR;
assert.equal(url, 'http://127.0.0.1:54321');
assert.ok(key && password?.length >= 10 && source && path.resolve(source) !== path.resolve('.'));
assert.match(execFileSync('docker', ['port', 'supabase_db_codex-coaching', '5432/tcp'], { encoding: 'utf8' }), /:54322\b/);
assert.ok(fs.existsSync(path.join(source, 'README.md')));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_codex-coaching', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'], { input: query, encoding: 'utf8' }).trim();
assert.equal(sql("select count(*) from pg_tables where schemaname='public' and tablename='coaching_generic_module_drafts'"), '1');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let signIn = await admin.auth.signInWithPassword({ email: 'local-pilot-admin@example.invalid', password });
if (signIn.error) signIn = await admin.auth.signUp({ email: 'local-pilot-admin@example.invalid', password });
assert.ifError(signIn.error);
sql(`update public.profiles set role='admin' where id=${quote(signIn.data.user.id)};`);
const modules = ['01','02','03','04'].map(number => {
  const manifest = parsePublicModule(JSON.parse(fs.readFileSync(path.join(source, 'learner-manifests', `m${number}.json`), 'utf8')));
  const assessment = JSON.parse(fs.readFileSync(path.join(source, 'private-assessment', `m${number}.json`), 'utf8'));
  assert.ok(assessment && typeof assessment === 'object' && !Array.isArray(assessment));
  return { manifest, assessment };
});
for (const { manifest, assessment } of modules) {
  const existing = sql(`select manifest::text from public.coaching_generic_module_drafts where module_key=${quote(manifest.moduleId)} and content_version=${manifest.contentVersion}`);
  if (existing) {
    assert.deepEqual(JSON.parse(existing), manifest, 'Immutable draft already differs; import a new version');
    continue;
  }
  sql(`begin;
    insert into public.coaching_generic_module_drafts(module_key,content_version,manifest,source_ref)
      values(${quote(manifest.moduleId)},${manifest.contentVersion},${quote(JSON.stringify(manifest))}::jsonb,${quote(manifest.sourceRevisionRef)});
    insert into coaching_private.generic_module_draft_assessment(module_key,content_version,assessment)
      values(${quote(manifest.moduleId)},${manifest.contentVersion},${quote(JSON.stringify(assessment))}::jsonb);
    commit;`);
}
const { data, error } = await admin.from('coaching_generic_module_drafts').select('module_key,content_version');
assert.ifError(error);
assert.equal(data.length, 4);
console.log('PASS four validated unpublished generic module drafts; authenticated local admin can read them');
