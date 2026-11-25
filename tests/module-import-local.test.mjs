// Run manually with LOCAL_SUPABASE_URL=http://127.0.0.1:54321 and LOCAL_SUPABASE_ANON_KEY.
// This writes disposable identities and drafts only to Supabase Local.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { reeManifest } from '../src/modules/ree.ts';

const url = process.env.LOCAL_SUPABASE_URL;
const key = process.env.LOCAL_SUPABASE_ANON_KEY;
assert.equal(url, 'http://127.0.0.1:54321', 'Local URL guard');
assert.ok(key, 'Local anon key required');
const port = execFileSync('docker', ['port', 'supabase_db_codex-coaching', '5432/tcp'], { encoding: 'utf8' });
assert.match(port, /:54322\b/, 'Local DB port guard');
function db(sql) {
  return execFileSync('docker', ['exec', 'supabase_db_codex-coaching', 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', sql], { encoding: 'utf8' }).trim();
}
assert.equal(db("select current_database() || '|' || current_setting('server_version_num')"), 'postgres|170012');
assert.equal(db("select count(*) from pg_tables where schemaname='public' and tablename='ielts_module_drafts'"), '1');
assert.equal(db("select has_schema_privilege('authenticated','coaching_private','USAGE')::text"), 'false');
const run = randomUUID().slice(0, 8);
const password = `LocalOnly!${randomUUID()}`;
const names = ['student', 'teacher', 'admin'];
const users = {};
for (const name of names) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `import-${name}-${run}@example.invalid`, password,
    options: { data: { role: 'admin' } } });
  assert.ifError(error);
  assert.ok(data.session?.access_token);
  users[name] = { client, id: data.user.id, token: data.session.access_token };
}
assert.equal(db(`select role from public.profiles where id='${users.student.id}'`), 'student', 'forged signup metadata ignored');
db(`update public.profiles set role='teacher' where id='${users.teacher.id}'; update public.profiles set role='admin' where id='${users.admin.id}'`);
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const actors = { anon, student: users.student.client, teacher: users.teacher.client, admin: users.admin.client };
const results = [];
async function check(label, fn) {
  try { await fn(); results.push(['PASS', label]); console.log('PASS', label); }
  catch (error) { results.push(['FAIL', label]); console.log('FAIL', label, error.message); }
}
const draft = (version = 1, moduleKey = `local-import-${run}`) => ({ ...structuredClone(reeManifest), key: moduleKey, version, id: randomUUID(), title: `Local import ${run}` });
for (const [name, client] of Object.entries(actors)) {
  await check(`${name} read draft`, async () => {
    const { data, error } = await client.from('ielts_module_drafts').select('id').eq('module_key', `local-import-${run}`);
    if (name === 'anon') { assert.ok(error); assert.equal(data, null); return; }
    assert.ifError(error);
    assert.equal(data.length, 0);
  });
  await check(`${name} insert draft`, async () => {
    const manifest = draft();
    const { data, error } = await client.from('ielts_module_drafts').insert({ module_key: manifest.key,
      content_version: manifest.version, title: manifest.title, manifest, created_by: users[name]?.id ?? users.student.id }).select('id').maybeSingle();
    if (name === 'admin') { assert.ifError(error); assert.ok(data?.id); }
    else assert.ok(error);
  });
}
const { data: adminDrafts, error: adminReadError } = await users.admin.client.from('ielts_module_drafts').select('id').eq('module_key', `local-import-${run}`);
assert.ifError(adminReadError);
assert.equal(adminDrafts.length, 1);
const draftId = adminDrafts[0].id;
for (const [name, client] of Object.entries(actors)) {
  await check(`${name} read existing draft`, async () => {
    const { data, error } = await client.from('ielts_module_drafts').select('id').eq('id', draftId);
    if (name === 'anon') { assert.ok(error); assert.equal(data, null); return; }
    assert.ifError(error);
    assert.equal(data.length, name === 'admin' ? 1 : 0);
  });
  await check(`${name} update denied`, async () => {
    const { data, error } = await client.from('ielts_module_drafts').update({ title: 'tampered' }).eq('id', draftId).select('id');
    assert.ok(error || data.length === 0);
  });
  await check(`${name} delete denied`, async () => {
    const { data, error } = await client.from('ielts_module_drafts').delete().eq('id', draftId).select('id');
    assert.ok(error || data.length === 0);
  });
}
for (const [label, mutate] of [
  ['duplicate version', (m) => { m.id = randomUUID(); }],
  ['zero version', (m) => { m.version = 0; }],
  ['decimal version', (m) => { m.version = 1.5; }],
  ['missing stages', (m) => { delete m.stages; }],
  ['stage order', (m) => { m.stages.reverse(); }],
  ['missing lesson content', (m) => { delete m.learn; }],
  ['nested private answer', (m) => { m.learn.secret = { answerKey: 'hidden' }; }],
  ['nested case variant', (m) => { m.learn.secret = { Correct: true }; }],
  ['nested isCorrect', (m) => { m.learn.secret = { isCorrect: true }; }],
]) {
  await check(`admin invalid ${label} denied`, async () => {
    const m = draft(1, label === 'duplicate version' ? `local-import-${run}` : `local-invalid-${run}-${randomUUID()}`); mutate(m);
    const { error } = await users.admin.client.from('ielts_module_drafts').insert({ module_key: m.key,
      content_version: m.version, title: m.title, manifest: m, created_by: users.admin.id });
    assert.ok(error);
  });
}
await check('admin forged created_by denied', async () => {
  const m = draft(2);
  const { error } = await users.admin.client.from('ielts_module_drafts').insert({ module_key: m.key,
    content_version: m.version, title: m.title, manifest: m, created_by: users.student.id });
  assert.ok(error);
});
await check('student forged role cannot see draft', async () => {
  const { data: profile } = await users.student.client.from('profiles').select('role').eq('id', users.student.id).single();
  assert.equal(profile.role, 'student');
  const { data } = await users.student.client.from('ielts_module_drafts').select('id').eq('id', draftId);
  assert.equal(data.length, 0);
});
await check('private answers unavailable through REST', async () => {
  for (const client of Object.values(actors)) {
    const { data, error } = await client.from('module_answer_keys').select('*').limit(1);
    assert.ok(error);
    assert.equal(data, null);
  }
});
await check('non-admin published module insert denied', async () => {
  for (const client of [anon, users.student.client, users.teacher.client]) {
    const { error } = await client.from('learning_modules').insert({ title: 'Unauthorized local test', program: 'IELTS', content: {}, is_published: true });
    assert.ok(error);
  }
});
await check('malformed JSON and oversized direct REST insert denied', async () => {
  const headers = { apikey: key, Authorization: `Bearer ${users.admin.token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  for (const body of ['{broken', JSON.stringify({ manifest: { padding: 'x'.repeat(500_100) } })]) {
    const response = await fetch(`${url}/rest/v1/ielts_module_drafts`, { method: 'POST', headers, body });
    assert.ok(response.status >= 400);
  }
});
await check('missing and invalid JWT denied', async () => {
  const missing = await fetch(`${url}/rest/v1/ielts_module_drafts?select=id`, { headers: { apikey: key } });
  assert.ok(missing.status === 401 || missing.status === 403);
  for (const token of ['invalid.jwt.value', `${users.admin.token.slice(0, -8)}badtoken`]) {
    const response = await fetch(`${url}/rest/v1/ielts_module_drafts?select=id`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    assert.ok(response.status === 401 || response.status === 403);
  }
});
await check('expired JWT denied', async () => {
  const secret = process.env.LOCAL_SUPABASE_JWT_SECRET;
  assert.ok(secret, 'Local-only JWT secret required');
  const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ aud: 'authenticated', role: 'authenticated', sub: users.admin.id, exp: Math.floor(Date.now() / 1000) - 60 })}`;
  const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
  const response = await fetch(`${url}/rest/v1/ielts_module_drafts?select=id`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 401);
});
console.log(`SUMMARY ${results.filter(([status]) => status === 'PASS').length}/${results.length}`);
process.exitCode = results.every(([status]) => status === 'PASS') ? 0 : 1;
