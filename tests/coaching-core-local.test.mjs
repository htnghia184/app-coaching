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
assert.equal(sql("select string_agg(relname || ':' || has_table_privilege('anon',oid,'SELECT')::text || ':' || has_table_privilege('anon',oid,'INSERT')::text,',' order by relname) from pg_class where relnamespace='public'::regnamespace and relname in ('exams','exam_results','exam_leads','exam_bundles')"),
  'exam_bundles:true:true,exam_leads:true:true,exam_results:true:true,exams:true:true', 'assessment app anonymous grants must remain');
assert.equal(sql("select has_table_privilege('anon','public.coaching_generic_attempts','SELECT')::text || ':' || has_table_privilege('anon','public.coaching_outcome_assessments','SELECT')::text"), 'false:false');
const anonHeaders = { apikey: key, Authorization: `Bearer ${key}` };
for (const table of ['exams','exam_results','exam_leads','exam_bundles']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers: anonHeaders });
  assert.equal(response.status, 200, `${table} anonymous assessment read boundary`);
}
for (const table of ['coaching_generic_attempts','coaching_outcome_assessments']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers: anonHeaders });
  assert.ok([401,403].includes(response.status), `${table} anonymous coaching read denied`);
}
const run = randomUUID().slice(0, 8);
const password = `LocalOnly!${randomUUID()}`;
const actors = {};
for (const role of ['student1', 'student2', 'coach1', 'coach2', 'admin']) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `pilot-${role}-${run}@example.invalid`, password });
  assert.ifError(error); assert.ok(data.session?.access_token);
  actors[role] = { client, id: data.user.id, token: data.session.access_token };
}
sql(`update public.profiles set role='teacher' where id in ('${actors.coach1.id}','${actors.coach2.id}')`);
sql(`update public.profiles set role='admin' where id='${actors.admin.id}'`);
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
const secondOutcome = `pilot-second-${run}`;
sql(`insert into public.coaching_learning_outcomes(id,version,statement,success_criteria) values ('${secondOutcome}',1,'Second synthetic need','Observed independently')`);
assert.ifError((await call('coach1','set_coaching_outcome_priority',{p_enrollment:ids.enrollment1,p_outcome:secondOutcome,p_version:1,p_priority:2,p_rationale:'Different diagnostic need',p_checkpoint:null})).error);
const directTargets = [{id:`pilot-${run}`,version:1},{id:secondOutcome,version:1}];
const directKey = randomUUID();
const directArgs = {p_plan:ids.plan1,p_title:'Two-LO direct task',p_reason:'One response supports two observations',p_module_key:null,p_content_version:null,p_targets:directTargets,p_minutes:7,p_request_key:directKey};
const direct = await call('coach1','prescribe_coaching_task_atomic',directArgs);
assert.ifError(direct.error);
assert.equal(sql(`select count(*) from public.coaching_task_outcomes where task_id='${direct.data.id}'`),'2');
assert.equal(sql(`select count(*) from public.coaching_work_logs where enrollment_id='${ids.enrollment1}' and note='One response supports two observations'`),'1');
const duplicateDirect = await call('coach1','prescribe_coaching_task_atomic',directArgs);
assert.ifError(duplicateDirect.error); assert.equal(duplicateDirect.data.id,direct.data.id);
assert.ok((await call('coach1','prescribe_coaching_task_atomic',{...directArgs,p_title:'Changed request'})).error);
const beforeInvalid = sql(`select count(*) from public.coaching_tasks where weekly_plan_id='${ids.plan1}'`);
assert.ok((await call('coach1','prescribe_coaching_task_atomic',{...directArgs,p_request_key:randomUUID(),p_title:'Invalid second LO',p_targets:[directTargets[0],{id:'nonexistent',version:1}]})).error);
assert.equal(sql(`select count(*) from public.coaching_tasks where weekly_plan_id='${ids.plan1}'`),beforeInvalid,'invalid target rolls back task');
const zeroTarget = await call('coach1','prescribe_coaching_task_atomic',{...directArgs,p_request_key:randomUUID(),p_title:'Administrative check-in',p_targets:[],p_minutes:2});
assert.ifError(zeroTarget.error); assert.equal(sql(`select count(*) from public.coaching_task_outcomes where task_id='${zeroTarget.data.id}'`),'0');
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
const moduleId = randomUUID();
const moduleTaskId = randomUUID();
const manifest = { moduleId: `pilot-${run}`, contentVersion: 1, verifyPolicy: { kind: 'rubric_sum', criteria: ['Respond','Explain','Example','Relevance'], minTotal: 6, noZero: true, freshRecording: true }, stages: [
  { id: 'Learn', activities: [{ id: 'learn-media', type: 'media', payload: { kind: 'youtube', assetRef: 'private:pilot:video' } }] },
  { id: 'Practice', activities: [{ id: 'practice-text', type: 'text_response', payload: { fields: [{ id: 'answer', prompt: 'Synthetic prompt', mode: 'open_response' }] } }] },
  { id: 'Verify', activities: [{ id: 'verify-record', type: 'recording', payload: { prompts: [{ id: 'verify-prompt', text: 'Synthetic prompt' }] } }] },
] };
sql(`insert into public.learning_modules(id,title,program,skill,level,content,is_published) values
 ('${moduleId}','Synthetic generic module','IELTS','Speaking','B1','${JSON.stringify(manifest)}'::jsonb,true);
 insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest) values
 ('pilot-${run}',1,'${moduleId}','${JSON.stringify(manifest)}'::jsonb);
 insert into public.coaching_tasks(id,weekly_plan_id,module_id,task_type,title) values
 ('${moduleTaskId}','${ids.plan1}','${moduleId}','lesson','Synthetic generic module');`);
const assignment = await call('coach1', 'assign_generic_coaching_module', { p_task: moduleTaskId, p_module_key: `pilot-${run}`, p_content_version: 1 });
assert.ifError(assignment.error);
for (const outcome of directTargets) assert.ifError((await call('coach1','link_coaching_task_outcome',{p_task:moduleTaskId,p_outcome:outcome.id,p_version:outcome.version,p_evidence_expected:'module_submission'})).error);
const otherOutcome = `pilot-other-${run}`;
sql(`insert into public.coaching_learning_outcomes(id,version,statement,success_criteria) values ('${otherOutcome}',1,'Other synthetic criterion','Observed separately')`);
const v2Links = [{ id: `pilot-${run}`, version: 1, statement: 'Develop a relevant answer' }, { id: otherOutcome, version: 1, statement: 'Other synthetic criterion' }];
const mappedModules = [];
for (const [index, links] of [v2Links,v2Links.slice(0,1)].entries()) {
  const moduleKey = `pilot-mapped-${index}-${run}`, mappedModuleId = randomUUID(), mappedTaskId = randomUUID();
  const mappedManifest = { schemaVersion: 2, moduleId: moduleKey, contentVersion: 1, outcomeStatement: 'Synthetic module objective, not learner mastery', outcomes: links, stages: [] };
  sql(`insert into public.learning_modules(id,title,program,skill,level,content,is_published) values ('${mappedModuleId}','Synthetic mapped','IELTS','Speaking','B1','${JSON.stringify(mappedManifest)}'::jsonb,true);
    insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest) values ('${moduleKey}',1,'${mappedModuleId}','${JSON.stringify(mappedManifest)}'::jsonb);
    insert into public.coaching_tasks(id,weekly_plan_id,module_id,task_type,title) values ('${mappedTaskId}','${ids.plan1}','${mappedModuleId}','lesson','Mapped synthetic')`);
  mappedModules.push({ moduleKey, mappedTaskId });
}
const firstMapping = await call('coach1','assign_generic_coaching_module',{p_task:mappedModules[0].mappedTaskId,p_module_key:mappedModules[0].moduleKey,p_content_version:1});
assert.ifError(firstMapping.error);
const atomicModule = await call('coach1','prescribe_coaching_task_atomic',{p_plan:ids.plan1,p_title:'Version-pinned module task',p_reason:'Coach selected a resource',p_module_key:mappedModules[0].moduleKey,p_content_version:1,p_targets:directTargets,p_minutes:3,p_request_key:randomUUID()});
assert.ifError(atomicModule.error);
assert.equal(sql(`select module_key||':'||content_version from public.coaching_generic_task_assignments where task_id='${atomicModule.data.id}'`),`${mappedModules[0].moduleKey}:1`);
assert.equal(sql(`select count(*) from public.coaching_enrollment_outcomes where enrollment_id='${ids.enrollment1}' and active`),'2','prescription does not change priorities');
sql("notify pgrst, 'reload schema'");
const { data: firstLinks, error: firstLinksError } = await actors.student1.client.from('coaching_generic_module_outcomes').select('outcome_id,outcome_version').eq('module_key',mappedModules[0].moduleKey);
assert.ifError(firstLinksError); assert.equal(firstLinks.length,2,'one module supports two versioned LOs');
const { data: hiddenMapping } = await actors.student1.client.from('coaching_generic_module_outcomes').select('outcome_id').eq('module_key',mappedModules[1].moduleKey);
assert.equal(hiddenMapping.length,0,'unassigned module mapping stays hidden');
assert.ifError((await call('coach1','assign_generic_coaching_module',{p_task:mappedModules[1].mappedTaskId,p_module_key:mappedModules[1].moduleKey,p_content_version:1})).error);
const { data: sharedLinks } = await actors.student1.client.from('coaching_generic_module_outcomes').select('module_key').eq('outcome_id',`pilot-${run}`);
assert.equal(sharedLinks.length,2,'two modules support one LO');
assert.throws(() => sql(`insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest) values ('bad-${run}',1,'${moduleId}','${JSON.stringify({schemaVersion:2,moduleId:`bad-${run}`,contentVersion:1,outcomes:[{id:'unapproved',version:1,statement:'Guess'}]})}'::jsonb)`));
sql(`insert into public.coaching_generic_recording_rules(module_key,content_version,prompt_id,min_seconds,max_seconds) values ('pilot-${run}',1,'verify-prompt',20,30)`);
const crossStart = await call('student2', 'start_generic_coaching_attempt', { p_task: moduleTaskId });
assert.ok(crossStart.error);
const attempt = await call('student1', 'start_generic_coaching_attempt', { p_task: moduleTaskId });
assert.ifError(attempt.error); assert.equal(attempt.data.content_version, 1);
const stage = await call('student1', 'complete_generic_coaching_stage', { p_attempt: attempt.data.id, p_stage: 'Learn' });
assert.ifError(stage.error); assert.deepEqual(stage.data.completed_stages, ['Learn']);
const response = await call('student1', 'save_generic_coaching_response', { p_attempt: attempt.data.id, p_activity: 'practice-text', p_response: { answer: 'Synthetic response' } });
assert.ifError(response.error);
const crossResponse = await call('student2', 'save_generic_coaching_response', { p_attempt: attempt.data.id, p_activity: 'practice-text', p_response: { answer: 'Intrusion' } });
assert.ok(crossResponse.error);
assert.ok((await call('student1', 'submit_generic_coaching_verify_atomic', { p_attempt: attempt.data.id, p_text_response: 'Premature', p_request_key: randomUUID() })).error);
assert.ifError((await call('student1', 'complete_generic_coaching_stage', { p_attempt: attempt.data.id, p_stage: 'Practice' })).error);
const recordingPath = `${actors.student1.id}/${moduleTaskId}/${attempt.data.id}/${randomUUID()}.webm`;
const upload = await actors.student1.client.storage.from('coaching-submissions').upload(recordingPath, new Blob(['synthetic local recording'], { type: 'audio/webm' }), { contentType: 'audio/webm' });
assert.ifError(upload.error);
const recording = await call('student1', 'save_generic_coaching_recording', { p_attempt: attempt.data.id, p_prompt: 'verify-prompt', p_path: recordingPath, p_seconds: 24 });
assert.ifError(recording.error);
assert.ok((await call('student1', 'save_generic_coaching_recording', { p_attempt: attempt.data.id, p_prompt: 'verify-prompt', p_path: recordingPath, p_seconds: 19 })).error, 'Verify duration is enforced');
assert.ok((await actors.student1.client.storage.from('coaching-submissions').createSignedUrl(recordingPath, 60)).data?.signedUrl);
assert.ok((await actors.coach1.client.storage.from('coaching-submissions').createSignedUrl(recordingPath, 60)).data?.signedUrl);
assert.ok((await actors.student2.client.storage.from('coaching-submissions').createSignedUrl(recordingPath, 60)).error);
const verify = await call('student1', 'submit_generic_coaching_verify_atomic', { p_attempt: attempt.data.id, p_text_response: 'Synthetic module evidence', p_request_key: randomUUID() });
assert.ifError(verify.error); assert.equal(verify.data.status, 'awaiting_review');
const moduleRevisionId = sql(`select submission_revision_id from public.coaching_generic_submissions where attempt_id='${attempt.data.id}'`);
assert.ok((await call('student1','submit_generic_coaching_verify',{p_attempt:attempt.data.id,p_submission_revision:moduleRevisionId})).error,'direct Verify RPC is not executable by student');
const moduleEvidence = [];
for (const outcome of directTargets) {
  const recorded = await call('coach1','record_coaching_outcome_evidence',{p_enrollment:ids.enrollment1,p_outcome:outcome.id,p_version:outcome.version,p_revision:moduleRevisionId,p_source_type:'module_submission',p_module:moduleId,p_module_version:1,p_session:null,p_summary:'One immutable Verify revision'});
  assert.ifError(recorded.error); assert.equal(recorded.data.module_attempt_id,attempt.data.id);
  moduleEvidence.push(recorded.data);
}
assert.ok((await call('coach1','record_coaching_outcome_evidence',{p_enrollment:ids.enrollment1,p_outcome:directTargets[0].id,p_version:1,p_revision:moduleRevisionId,p_source_type:'module_submission',p_module:moduleId,p_module_version:2,p_session:null,p_summary:'Wrong version'})).error);
for (const [index,outcome] of directTargets.entries()) {
  const assessed = await call('coach1','record_coaching_outcome_assessment',{p_enrollment:ids.enrollment1,p_outcome:outcome.id,p_version:1,p_status:index===0?'developing':'demonstrated',p_rationale:'Evidence-specific coach decision',p_feedback:'Targeted feedback',p_evidence_ids:[moduleEvidence[index].id]});
  assert.ifError(assessed.error);
}
const sessionId = randomUUID();
sql(`insert into public.coaching_sessions(id,enrollment_id,coach_id,scheduled_at,duration_minutes,location_type,agenda,summary,next_steps,status) values
 ('${sessionId}','${ids.enrollment1}','${actors.coach1.id}',now(),20,'online','Synthetic check-in','Observed a relevant answer without a module','Recheck later','completed')`);
const liveEvidence = await call('coach1','record_coaching_outcome_evidence',{p_enrollment:ids.enrollment1,p_outcome:secondOutcome,p_version:1,p_revision:null,p_source_type:'live_session_note',p_module:null,p_module_version:null,p_session:sessionId,p_summary:'Observed live without module'});
assert.ifError(liveEvidence.error); assert.equal(liveEvidence.data.module_attempt_id,null);
assert.ifError((await call('coach1','record_coaching_outcome_assessment',{p_enrollment:ids.enrollment1,p_outcome:secondOutcome,p_version:1,p_status:'demonstrated',p_rationale:'Live observation',p_feedback:'Keep practicing',p_evidence_ids:[liveEvidence.data.id]})).error);
const assessmentsBeforeModuleReview = sql(`select count(*) from public.coaching_outcome_assessments where enrollment_id='${ids.enrollment1}' and outcome_id='pilot-${run}'`);
assert.ok((await call('coach2', 'review_generic_coaching_verify', { p_attempt: attempt.data.id, p_review: { scores: [2,2,1,1] } })).error);
assert.ok((await call('coach1', 'review_generic_coaching_verify', { p_attempt: attempt.data.id, p_review: { scores: [2,2,2] } })).error);
const moduleReview = await call('coach1', 'review_generic_coaching_verify', { p_attempt: attempt.data.id, p_review: { scores: [2,2,1,1] } });
assert.ifError(moduleReview.error); assert.equal(moduleReview.data.passed, true);
assert.equal(sql(`select status from public.coaching_generic_attempts where id='${attempt.data.id}'`), 'completed');
assert.equal(sql(`select count(*) from public.coaching_outcome_assessments where enrollment_id='${ids.enrollment1}' and outcome_id='pilot-${run}'`), assessmentsBeforeModuleReview, 'module completion must not create LO mastery');
const perItemIds = Array.from({ length: 6 }, (_, index) => `apply-${index + 1}`);
const perItemManifest = { moduleId: `pilot-per-item-${run}`, contentVersion: 1,
  verifyPolicy: { kind: 'per_item_pass', itemIds: perItemIds, minPass: 5, noQuestionRepeat: true, reuseApply: true },
  stages: [{ id: 'Apply', activities: [{ id: 'apply-record', type: 'recording', payload: { prompts: perItemIds.map(id => ({ id, text: 'Synthetic' })) } }] },
    { id: 'Verify', activities: [{ id: 'verify-submit', type: 'evidence_submit', payload: { evidenceItemIds: perItemIds } }] }] };
const perItemModuleId = randomUUID(), perItemTaskId = randomUUID();
sql(`insert into public.learning_modules(id,title,program,skill,level,content,is_published) values
 ('${perItemModuleId}','Synthetic per-item module','IELTS','Speaking','B1','${JSON.stringify(perItemManifest)}'::jsonb,true);
 insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest) values
 ('pilot-per-item-${run}',1,'${perItemModuleId}','${JSON.stringify(perItemManifest)}'::jsonb);
 insert into public.coaching_tasks(id,weekly_plan_id,module_id,task_type,title) values
 ('${perItemTaskId}','${ids.plan1}','${perItemModuleId}','lesson','Per-item module')`);
assert.ifError((await call('coach1', 'assign_generic_coaching_module', { p_task: perItemTaskId, p_module_key: `pilot-per-item-${run}`, p_content_version: 1 })).error);
for (const prompt of perItemIds) sql(`insert into public.coaching_generic_recording_rules(module_key,content_version,prompt_id,min_seconds,max_seconds) values ('pilot-per-item-${run}',1,'${prompt}',10,15)`);
const perItemAttempt = await call('student1', 'start_generic_coaching_attempt', { p_task: perItemTaskId });
assert.ifError(perItemAttempt.error);
for (const prompt of perItemIds) {
  const path = `${actors.student1.id}/${perItemTaskId}/${perItemAttempt.data.id}/${randomUUID()}.webm`;
  assert.ifError((await actors.student1.client.storage.from('coaching-submissions').upload(path, new Blob(['synthetic'], { type: 'audio/webm' }), { contentType: 'audio/webm' })).error);
  assert.ifError((await call('student1', 'save_generic_coaching_recording', { p_attempt: perItemAttempt.data.id, p_prompt: prompt, p_path: path, p_seconds: 12 })).error);
}
assert.ifError((await call('student1', 'complete_generic_coaching_stage', { p_attempt: perItemAttempt.data.id, p_stage: 'Apply' })).error);
assert.ifError((await call('student1', 'submit_generic_coaching_verify_atomic', { p_attempt: perItemAttempt.data.id, p_text_response: 'Six synthetic recordings', p_request_key: randomUUID() })).error);
const perItemReview = await call('coach1', 'review_generic_coaching_verify', { p_attempt: perItemAttempt.data.id,
  p_review: { reviewedItems: perItemIds, passedItems: perItemIds.slice(0, 4), repeatedItems: [] } });
assert.ifError(perItemReview.error); assert.equal(perItemReview.data.passed, false);
const targeted = await call('student1', 'start_generic_coaching_attempt', { p_task: perItemTaskId });
assert.ifError(targeted.error);
assert.equal(sql(`select count(*) from public.coaching_generic_inherited_recordings where attempt_id='${targeted.data.id}'`), '4');
for (const prompt of perItemIds.slice(4)) {
  const path = `${actors.student1.id}/${perItemTaskId}/${targeted.data.id}/${randomUUID()}.webm`;
  assert.ifError((await actors.student1.client.storage.from('coaching-submissions').upload(path, new Blob(['targeted retry'], { type: 'audio/webm' }), { contentType: 'audio/webm' })).error);
  assert.ifError((await call('student1', 'save_generic_coaching_recording', { p_attempt: targeted.data.id, p_prompt: prompt, p_path: path, p_seconds: 12 })).error);
}
assert.ifError((await call('student1', 'complete_generic_coaching_stage', { p_attempt: targeted.data.id, p_stage: 'Apply' })).error);
assert.ifError((await call('student1', 'submit_generic_coaching_verify_atomic', { p_attempt: targeted.data.id, p_text_response: 'Targeted M02 revision', p_request_key: randomUUID() })).error);
const targetedReview = await call('coach1', 'review_generic_coaching_verify', { p_attempt: targeted.data.id,
  p_review: { reviewedItems: perItemIds, passedItems: perItemIds.slice(0, 5), repeatedItems: [perItemIds[5]] } });
assert.ifError(targetedReview.error); assert.equal(targetedReview.data.passed, false);
const thirdAttempt = await call('student1','start_generic_coaching_attempt',{p_task:perItemTaskId});
assert.ifError(thirdAttempt.error);
assert.equal(sql(`select count(*) from public.coaching_generic_inherited_recordings where attempt_id='${thirdAttempt.data.id}'`),'5','third retry carries accepted recordings across two reviews');
const thirdPath = `${actors.student1.id}/${perItemTaskId}/${thirdAttempt.data.id}/${randomUUID()}.webm`;
assert.ifError((await actors.student1.client.storage.from('coaching-submissions').upload(thirdPath,new Blob(['third revision'],{type:'audio/webm'}),{contentType:'audio/webm'})).error);
assert.ifError((await call('student1','save_generic_coaching_recording',{p_attempt:thirdAttempt.data.id,p_prompt:perItemIds[5],p_path:thirdPath,p_seconds:12})).error);
assert.ifError((await call('student1','complete_generic_coaching_stage',{p_attempt:thirdAttempt.data.id,p_stage:'Apply'})).error);
assert.ifError((await call('student1','submit_generic_coaching_verify_atomic',{p_attempt:thirdAttempt.data.id,p_text_response:'Third M02 revision',p_request_key:randomUUID()})).error);
const finalReview = await call('coach1','review_generic_coaching_verify',{p_attempt:thirdAttempt.data.id,p_review:{reviewedItems:perItemIds,passedItems:perItemIds,repeatedItems:[]}});
assert.ifError(finalReview.error); assert.equal(finalReview.data.passed,true);
assert.equal(sql(`select count(*) from public.coaching_generic_reviews where attempt_id in ('${perItemAttempt.data.id}','${targeted.data.id}','${thirdAttempt.data.id}')`),'3');
const { data: versions } = await actors.student1.client.from('coaching_generic_module_versions').select('module_key,content_version').eq('module_key', `pilot-${run}`);
assert.equal(versions.length, 1);
const { data: hiddenVersions } = await actors.student2.client.from('coaching_generic_module_versions').select('module_key').eq('module_key', `pilot-${run}`);
assert.equal(hiddenVersions.length, 0);
const isolatedVersionId = randomUUID();
const isolatedManifest = { ...manifest, contentVersion: 2 };
sql(`insert into public.learning_modules(id,title,program,skill,level,content,is_published) values ('${isolatedVersionId}','Isolated version','IELTS','Speaking','B1','${JSON.stringify(isolatedManifest)}'::jsonb,true);
 insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest) values ('pilot-${run}',2,'${isolatedVersionId}','${JSON.stringify(isolatedManifest)}'::jsonb)`);
const { data: isolatedVersions, error: isolatedVersionError } = await actors.student1.client.from('coaching_generic_module_versions').select('content_version').eq('module_key', `pilot-${run}`);
assert.ifError(isolatedVersionError); assert.deepEqual(isolatedVersions.map(row => row.content_version), [1], 'unassigned content version hidden');
assert.equal(sql("select has_table_privilege('authenticated','coaching_private.generic_module_draft_assessment','SELECT')"), 'f');
assert.ok((await call('student1', 'save_generic_coaching_response', { p_attempt: perItemAttempt.data.id, p_activity: 'practice-text', p_response: { answer: 'Cross-module' } })).error, 'activity cannot cross module');
assert.ok((await call('student1', 'save_generic_coaching_response', { p_attempt: attempt.data.id, p_activity: 'practice-text', p_response: { answer: 5 } })).error, 'typed response required');
const typedMulti = {type:'choice',payload:{items:[{id:'q1',fields:[{id:'pick',mode:'multi',options:[{id:'a'},{id:'b'}]}]}]}};
const typedSql = response => sql(`select coaching_private.validate_generic_activity_response('${JSON.stringify(typedMulti)}'::jsonb,'${JSON.stringify(response)}'::jsonb)`);
assert.equal(typedSql({'q1-pick':['a','b']}),'t');
assert.equal(typedSql({'q1-pick':['a','a']}),'f','duplicate multi-select rejected');
assert.equal(typedSql({'q1-pick':['a'],'foreign':'x'}),'f','extra response key rejected');
assert.ok((await actors.student1.client.storage.from('coaching-submissions').remove([recordingPath])).error, 'referenced storage object cannot be deleted');
assert.ok((await actors.student1.client.storage.from('coaching-submissions').upload(recordingPath, new Blob(['replace'], { type: 'audio/webm' }), { contentType: 'audio/webm', upsert: true })).error, 'referenced storage object cannot be replaced');
assert.throws(() => sql(`delete from public.coaching_generic_recordings where id='${recording.data.id}'`), /Recording evidence is immutable/);
const retryTaskId = randomUUID();
sql(`insert into public.coaching_tasks(id,weekly_plan_id,module_id,task_type,title) values ('${retryTaskId}','${ids.plan1}','${moduleId}','lesson','Atomic Verify test')`);
assert.ifError((await call('coach1', 'assign_generic_coaching_module', { p_task: retryTaskId, p_module_key: `pilot-${run}`, p_content_version: 1 })).error);
const retryAttempt = await call('student1', 'start_generic_coaching_attempt', { p_task: retryTaskId });
assert.ifError(retryAttempt.error);
assert.ifError((await call('student1', 'complete_generic_coaching_stage', { p_attempt: retryAttempt.data.id, p_stage: 'Learn' })).error);
const partialBefore = Number(sql(`select count(*) from public.coaching_submission_revisions where task_id='${retryTaskId}'`));
assert.ok((await call('student1', 'submit_generic_coaching_verify_atomic', { p_attempt: retryAttempt.data.id, p_text_response: 'Premature', p_request_key: randomUUID() })).error);
assert.equal(Number(sql(`select count(*) from public.coaching_submission_revisions where task_id='${retryTaskId}'`)), partialBefore, 'failed atomic Verify leaves no revision');
assert.ok((await call('student1', 'complete_generic_coaching_stage', { p_attempt: retryAttempt.data.id, p_stage: 'Practice' })).error, 'missing required activity response');
assert.ifError((await call('student1', 'save_generic_coaching_response', { p_attempt: retryAttempt.data.id, p_activity: 'practice-text', p_response: { answer: 'Typed synthetic response' } })).error);
assert.ifError((await call('student1', 'complete_generic_coaching_stage', { p_attempt: retryAttempt.data.id, p_stage: 'Practice' })).error);
const retryPath = `${actors.student1.id}/${retryTaskId}/${retryAttempt.data.id}/${randomUUID()}.webm`;
assert.ifError((await actors.student1.client.storage.from('coaching-submissions').upload(retryPath, new Blob(['retry'], { type: 'audio/webm' }), { contentType: 'audio/webm' })).error);
assert.ifError((await call('student1', 'save_generic_coaching_recording', { p_attempt: retryAttempt.data.id, p_prompt: 'verify-prompt', p_path: retryPath, p_seconds: 24 })).error);
const requestKey = randomUUID();
const atomicArgs = { p_attempt: retryAttempt.data.id, p_text_response: 'Atomic synthetic Verify', p_request_key: requestKey };
const concurrent = await Promise.all([call('student1', 'submit_generic_coaching_verify_atomic', atomicArgs), call('student1', 'submit_generic_coaching_verify_atomic', atomicArgs)]);
concurrent.forEach(result => assert.ifError(result.error));
assert.equal(concurrent[0].data.id, concurrent[1].data.id);
assert.ifError((await call('student1', 'submit_generic_coaching_verify_atomic', atomicArgs)).error, 'same-key retry is idempotent');
assert.ok((await call('student1', 'submit_generic_coaching_verify_atomic', { ...atomicArgs, p_text_response: 'Changed payload' })).error, 'same-key changed payload denied');
assert.ok((await call('student1', 'submit_generic_coaching_verify_atomic', { ...atomicArgs, p_request_key: randomUUID() })).error, 'different-key retry denied');
assert.equal(Number(sql(`select count(*) from public.coaching_submission_revisions where task_id='${retryTaskId}'`)), partialBefore + 1);
assert.equal(sql(`select count(*) from public.coaching_generic_submissions where attempt_id='${retryAttempt.data.id}'`), '1');
assert.throws(() => sql(`update public.coaching_generic_module_versions set manifest='{}'::jsonb where module_key='pilot-${run}' and content_version=1`), /Published module versions are immutable/);
const mediaManifest = { moduleId: 'pilot-media-test', contentVersion: 1, stages: [{ id: 'Learn', activities: [{ id: 'media', type: 'media', payload: { kind: 'youtube', assetRef: 'private:pilot:video' } }] }] };
let mediaModuleId = sql("select module_id from public.coaching_generic_module_versions where module_key='pilot-media-test' and content_version=1");
if (!mediaModuleId) {
  mediaModuleId = randomUUID();
  sql(`insert into public.learning_modules(id,title,program,skill,level,content,is_published) values
    ('${mediaModuleId}','Synthetic media module','IELTS','Speaking','B1','${JSON.stringify(mediaManifest)}'::jsonb,true);
    insert into public.coaching_generic_module_versions(module_key,content_version,module_id,manifest) values
    ('pilot-media-test',1,'${mediaModuleId}','${JSON.stringify(mediaManifest)}'::jsonb)`);
}
const mediaTaskId = randomUUID();
sql(`insert into public.coaching_tasks(id,weekly_plan_id,module_id,task_type,title) values
 ('${mediaTaskId}','${ids.plan1}','${mediaModuleId}','lesson','Synthetic media task')`);
assert.ifError((await call('coach1', 'assign_generic_coaching_module', { p_task: mediaTaskId, p_module_key: 'pilot-media-test', p_content_version: 1 })).error);
const endpoint = `${url}/functions/v1/module-media-resolver`;
const mediaBody = { assetRef: 'private:pilot:video', taskId: mediaTaskId, moduleKey: 'pilot-media-test', contentVersion: 1 };
async function mediaRequest(role, body = mediaBody, origin = 'http://127.0.0.1:5173') {
  return fetch(endpoint, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', Origin: origin,
    ...(role ? { Authorization: `Bearer ${actors[role].token}` } : {}) }, body: JSON.stringify(body) });
}
assert.equal((await mediaRequest('student1')).status, 200);
assert.equal((await mediaRequest('coach1')).status, 200);
assert.equal((await mediaRequest('admin')).status, 200);
for (const role of ['student2', 'coach2']) assert.equal((await mediaRequest(role)).status, 403);
assert.equal((await mediaRequest(null)).status, 401);
assert.equal((await mediaRequest('student1', { ...mediaBody, contentVersion: 2 })).status, 404);
assert.equal((await mediaRequest('student1', { ...mediaBody, assetRef: 'private:pilot:other' })).status, 404);
assert.equal((await mediaRequest('student1', mediaBody, 'https://unrelated.example')).status, 403);
if (sql("select count(*) from public.coaching_generic_module_drafts where module_key='ielts-speaking-m02'")==='1') {
  const { data: adminDrafts, error: draftError } = await actors.admin.client.from('coaching_generic_module_drafts').select('module_key');
  assert.ifError(draftError); assert.equal(adminDrafts.length, 4);
  const { data: studentDrafts } = await actors.student1.client.from('coaching_generic_module_drafts').select('module_key');
  assert.equal(studentDrafts.length, 0);
  const draftBody = { moduleKey: 'ielts-speaking-m02', contentVersion: 1, assetRef: 'private:m02:video', draftPreview: true };
  assert.equal((await mediaRequest('admin', draftBody)).status, 200);
  assert.equal((await mediaRequest('student1', draftBody)).status, 403);
  assert.equal((await mediaRequest(null, draftBody)).status, 401);
}
console.log('PASS authenticated assignment, submission, coach review, revision, versioned evidence, reassessment, next task, cross-enrollment denial, immutable assessment, priority deactivation and coach minutes');
console.log('PASS generic module version assignment, progress response, recording metadata and Verify submission with cross-enrollment denial');
console.log('PASS media Edge Function student, assigned coach and admin; unrelated users, anonymous, wrong version/asset/origin denied');
console.log('PASS hardening: cross-version RLS, typed activity, duration, recording immutability, atomic concurrency/retry, targeted M02 revision and private draft boundaries');
