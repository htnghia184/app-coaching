// Run explicitly against the verified disposable Supabase Local instance only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.LOCAL_SUPABASE_URL;
const key = process.env.LOCAL_SUPABASE_ANON_KEY;
assert.equal(url, 'http://127.0.0.1:54321', 'Local URL guard');
assert.ok(key, 'Local anon key required');
assert.match(execFileSync('docker', ['port', 'supabase_db_codex-coaching', '5432/tcp'], { encoding: 'utf8' }), /:54322\b/);
const sql = query => execFileSync('docker', ['exec', 'supabase_db_codex-coaching', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-Atc', query], { encoding: 'utf8' }).trim();
assert.equal(sql("select count(*) from pg_tables where schemaname='public' and tablename='coaching_outcome_assessments'"), '1');
const run = randomUUID().slice(0, 8);
const password = `LocalOnly!${randomUUID()}`;
const actors = {};
for (const role of ['student1', 'student2', 'coach1', 'coach2']) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `pilot-${role}-${run}@example.invalid`, password });
  assert.ifError(error); assert.ok(data.session?.access_token);
  actors[role] = { client, id: data.user.id };
}
sql(`update public.profiles set role='teacher' where id in ('${actors.coach1.id}','${actors.coach2.id}')`);
const ids = Object.fromEntries(['enrollment1','enrollment2','plan1','plan2','task1','task2','submission1','submission2'].map(name => [name, randomUUID()]));
sql(`insert into public.coaching_enrollments(id,student_id,coach_id,program) values
 ('${ids.enrollment1}','${actors.student1.id}','${actors.coach1.id}','IELTS'),
 ('${ids.enrollment2}','${actors.student2.id}','${actors.coach2.id}','IELTS');
 insert into public.coaching_weekly_plans(id,enrollment_id,week_number,status) values
 ('${ids.plan1}','${ids.enrollment1}',1,'active'),('${ids.plan2}','${ids.enrollment2}',1,'active');
 insert into public.coaching_tasks(id,weekly_plan_id,task_type,title) values
 ('${ids.task1}','${ids.plan1}','text','Pilot task'),('${ids.task2}','${ids.plan2}','text','Other task');
 insert into public.coaching_submissions(id,task_id,student_id,text_response) values
 ('${ids.submission1}','${ids.task1}','${actors.student1.id}','First answer'),
 ('${ids.submission2}','${ids.task2}','${actors.student2.id}','Other answer');
 insert into public.coaching_learning_outcomes(id,version,statement,success_criteria) values
 ('pilot-${run}',1,'Develop a relevant answer','Clear response');`);
ids.revision1 = sql(`select id from public.coaching_submission_revisions where submission_id='${ids.submission1}' and revision_number=1`);
ids.revision2 = sql(`select id from public.coaching_submission_revisions where submission_id='${ids.submission2}' and revision_number=1`);
assert.ok(ids.revision1 && ids.revision2, 'existing submission trigger must create revisions');
sql("notify pgrst, 'reload schema'");
const call = (role, name, args) => actors[role].client.rpc(name, args);
const p = { p_enrollment: ids.enrollment1, p_outcome: `pilot-${run}`, p_version: 1 };
const priority = await call('coach1', 'set_coaching_outcome_priority', { ...p, p_priority: 1, p_rationale: 'Diagnostic need', p_checkpoint: null });
assert.ifError(priority.error);
const unauthorized = await call('coach2', 'set_coaching_outcome_priority', { ...p, p_priority: 1, p_rationale: 'Cross enrollment', p_checkpoint: null });
assert.ok(unauthorized.error, 'other coach must be denied');
const link = await call('coach1', 'link_coaching_task_outcome', { p_task: ids.task1, p_outcome: p.p_outcome, p_version: 1, p_evidence_expected: 'task_submission' });
assert.ifError(link.error);
const evidenceArgs = { ...p, p_revision: ids.revision1, p_source_type: 'task_submission', p_module: null, p_module_version: null, p_session: null, p_summary: 'Observed answer' };
const crossEvidence = await call('coach1', 'record_coaching_outcome_evidence', { ...evidenceArgs, p_revision: ids.revision2 });
assert.ok(crossEvidence.error, 'other learner revision must be denied');
const evidence = await call('coach1', 'record_coaching_outcome_evidence', evidenceArgs);
assert.ifError(evidence.error);
const assess = status => call('coach1', 'record_coaching_outcome_assessment', { ...p, p_status: status, p_rationale: 'Observed criterion', p_feedback: 'Revise answer', p_evidence_ids: [evidence.data.id] });
assert.ifError((await assess('developing')).error);
assert.ifError((await assess('demonstrated')).error);
const { data: history, error: historyError } = await actors.student1.client.from('coaching_outcome_assessments').select('id,status').eq('enrollment_id', ids.enrollment1);
assert.ifError(historyError); assert.equal(history.length, 2);
const { data: otherHistory, error: otherError } = await actors.student2.client.from('coaching_outcome_assessments').select('id').eq('enrollment_id', ids.enrollment1);
assert.ifError(otherError); assert.equal(otherHistory.length, 0);
const update = await actors.coach1.client.from('coaching_outcome_assessments').update({ status: 'demonstrated' }).eq('id', history[0].id).select('id');
assert.ok(update.error || update.data.length === 0, 'assessment update must be denied');
const deactivate = await call('coach1', 'deactivate_coaching_outcome_priority', p);
assert.ifError(deactivate.error); assert.equal(deactivate.data.active, false);
const work = await call('coach1', 'record_coaching_work', { p_enrollment: ids.enrollment1, p_type: 'review', p_minutes: 11, p_day: '2026-11-27', p_note: 'Pilot review' });
assert.ifError(work.error); assert.equal(work.data.minutes, 11);
const review = await call('coach1', 'review_coaching_submission', { p_submission_id: ids.submission1, p_feedback_text: 'Add a specific example', p_feedback_score: 5, p_feedback_data: {}, p_request_revision: true });
assert.ifError(review.error); assert.equal(review.data.status, 'revision_requested');
const crossReview = await call('coach2', 'review_coaching_submission', { p_submission_id: ids.submission1, p_feedback_text: 'Wrong coach', p_feedback_score: 5, p_feedback_data: {}, p_request_revision: false });
assert.ok(crossReview.error);
const crossRevision = await call('student2', 'update_own_coaching_submission', { p_submission_id: ids.submission1, p_text_response: 'Wrong learner', p_storage_path: null, p_duration_seconds: null, p_submit: true });
assert.ok(crossRevision.error);
const revision = await call('student1', 'update_own_coaching_submission', { p_submission_id: ids.submission1, p_text_response: 'Revised answer with example', p_storage_path: null, p_duration_seconds: null, p_submit: true });
assert.ifError(revision.error); assert.equal(revision.data.status, 'submitted');
assert.equal(sql(`select count(*) from public.coaching_submission_revisions where submission_id='${ids.submission1}'`), '2');
const newRevisionId = sql(`select id from public.coaching_submission_revisions where submission_id='${ids.submission1}' and revision_number=2`);
assert.ifError((await call('coach1', 'set_coaching_outcome_priority', { ...p, p_priority: 1, p_rationale: 'Recheck revised answer', p_checkpoint: null })).error);
const revisedEvidence = await call('coach1', 'record_coaching_outcome_evidence', { ...evidenceArgs, p_revision: newRevisionId, p_summary: 'Revised answer' });
assert.ifError(revisedEvidence.error); assert.notEqual(revisedEvidence.data.submission_revision_id, evidence.data.submission_revision_id);
const nextTask = await actors.coach1.client.from('coaching_tasks').insert({ weekly_plan_id: ids.plan1, task_type: 'text', title: 'Next personalized answer', instructions: 'Use the coach feedback', sequence: 2 }).select('id').single();
assert.ifError(nextTask.error);
assert.ifError((await call('coach1', 'link_coaching_task_outcome', { p_task: nextTask.data.id, p_outcome: p.p_outcome, p_version: 1, p_evidence_expected: 'task_submission' })).error);
console.log('PASS authenticated assignment, submission, coach review, revision, versioned evidence, reassessment, next task, cross-enrollment denial, immutable assessment, priority deactivation and coach minutes');
