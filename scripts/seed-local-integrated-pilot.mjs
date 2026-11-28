// Disposable browser fixtures. Run only with the guarded Supabase Local URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { fourModulePreviews } from '../src/modules/fourModulePreviews.ts';
import { pilotOutcomes } from '../src/coachingCore/syntheticPilot.ts';

const url = process.env.LOCAL_SUPABASE_URL;
const key = process.env.LOCAL_SUPABASE_ANON_KEY;
const password = process.env.LOCAL_PILOT_PASSWORD;
assert.equal(url, 'http://127.0.0.1:54321');
assert.ok(key && password && password.length >= 10);
assert.match(execFileSync('docker', ['port', 'supabase_db_codex-coaching', '5432/tcp'], { encoding: 'utf8' }), /:54322\b/);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_codex-coaching', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'], { input: query, encoding: 'utf8' }).trim();
async function user(email) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let response = await client.auth.signInWithPassword({ email, password });
  if (response.error) response = await client.auth.signUp({ email, password });
  assert.ifError(response.error); assert.ok(response.data.user?.id);
  return response.data.user.id;
}
const coach = await user('local-pilot-coach@example.invalid');
const student = await user('local-pilot-student@example.invalid');
sql(`update public.profiles set role='teacher',full_name='Pilot Coach' where id=${quote(coach)};
 update public.profiles set role='student',full_name='Pilot Learner' where id=${quote(student)};`);
for (const outcome of pilotOutcomes) sql(`insert into public.coaching_learning_outcomes(id,version,statement,success_criteria)
 values(${quote(outcome.id)},${outcome.version},${quote(outcome.statement)},${quote(outcome.successCriteria)}) on conflict (id,version) do nothing;`);
let enrollment = sql(`select id from public.coaching_enrollments where student_id=${quote(student)} and coach_id=${quote(coach)} order by created_at desc limit 1;`);
if (!enrollment) {
  enrollment = randomUUID();
  sql(`insert into public.coaching_enrollments(id,student_id,coach_id,program,goal_label)
    values(${quote(enrollment)},${quote(student)},${quote(coach)},'IELTS','IELTS Speaking 6.5');
    insert into public.coaching_weekly_plans(enrollment_id,week_number,title,focus,status)
    values(${quote(enrollment)},1,'Personalized Speaking missions','Pilot LO priorities','active');`);
}
for (const manifest of fourModulePreviews) {
  if (sql(`select count(*) from public.coaching_generic_module_versions where module_key=${quote(manifest.moduleId)} and content_version=${manifest.contentVersion};`) === '0') {
    const id = randomUUID(); const json = quote(JSON.stringify(manifest));
    sql(`insert into public.learning_modules(id,title,program,skill,level,content,is_published)
      values(${quote(id)},${quote(manifest.title)},'IELTS','Speaking','B1',${json}::jsonb,true);
      insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest)
      values(${quote(manifest.moduleId)},${manifest.contentVersion},${quote(id)},${json}::jsonb);`);
  }
}
sql("notify pgrst, 'reload schema';");
console.log('PASS local coach, learner, enrollment, weekly plan, four synthetic Speaking module versions and LO catalog ready');
console.log('Local sign-in emails: local-pilot-coach@example.invalid and local-pilot-student@example.invalid');
