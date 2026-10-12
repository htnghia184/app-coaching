#!/usr/bin/env node
/**
 * E-Master Coaching — SLICE 02 TARGETED TEST
 * (Roadmap + Progress + Coach attention + Dashboard data/security).
 *
 * ADMIN/TEST TOOLING ONLY. Uses ONLY the public/anon key + normal per-user
 * signInWithPassword sessions, so every query/RPC is subject to the same
 * RLS/JWT rules as a real user. NEVER uses the service-role key.
 *
 * Scope: Slice 02 targeted checks only (NOT the historical 59-test suite).
 * UI-only checks (rendering/ordering/empty-states) are reported as NOT EXECUTED
 * here because this harness is API/data + RLS level.
 *
 * Usage:
 *   node --env-file=.env --env-file=scripts/.env.test scripts/e2e-slice-02.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const PASSWORD = process.env.TEST_USER_PASSWORD;

const results = [];
let fails = 0;
function record(section, name, status, evidence = '') {
  if (status === 'FAIL') fails++;
  results.push({ section, name, status, evidence: String(evidence).slice(0, 300) });
}
const pass = (s, n, e) => record(s, n, 'PASS', e);
const fail = (s, n, e) => record(s, n, 'FAIL', e);
const skip = (s, n, e) => record(s, n, 'NOT EXECUTED', e);
const info = (s, n, e) => record(s, n, 'INFO', e);
const ok = (s, n, e) => pass(s, n, e);
const deny = (s, n, e) => pass(s, n, e);

function client() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(email) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { client: c, user: data.user };
}
const errText = (e) => (e ? `${e.code ?? ''} ${e.message ?? ''}`.trim() : '');

async function main() {
  if (!URL || !ANON || !PASSWORD) {
    console.error('Missing env (SUPABASE_URL/VITE_SUPABASE_URL, anon key, TEST_USER_PASSWORD).');
    process.exit(1);
  }

  const admin = await signIn('admin-test@e-master.vn');
  const coachA = await signIn('teacher2@e-master.vn');
  const coachB = await signIn('teacher3@e-master.vn');
  const studentA = await signIn('student2@e-master.vn');
  const studentB = await signIn('student3@e-master.vn');
  const [coachAId, studentAId] = [coachA.user.id, studentA.user.id];

  /* ---------------- Setup: enrollment ---------------- */
  const { data: existing } = await admin.client
    .from('coaching_enrollments')
    .select('id')
    .eq('student_id', studentAId)
    .eq('coach_id', coachAId)
    .order('created_at', { ascending: false });
  let enrollmentId = existing?.[0]?.id ?? null;
  if (!enrollmentId) {
    const { data, error } = await admin.client
      .from('coaching_enrollments')
      .insert({
        student_id: studentAId,
        coach_id: coachAId,
        program: 'TOEIC',
        goal_label: 'Slice 02',
        baseline_data: { overall: 450 },
        target_data: { overall: 600 },
        target_date: '2026-12-31',
        status: 'active',
      })
      .select('*')
      .single();
    if (error) throw new Error(`create enrollment: ${errText(error)}`);
    enrollmentId = data.id;
  }
  info('Setup', 'enrollment', enrollmentId);

  /* ---------------- Setup: weekly plan + 5 tasks (Coach A) ---------------- */
  const planRes = await coachA.client
    .from('coaching_weekly_plans')
    .select('week_number')
    .eq('enrollment_id', enrollmentId)
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextWeek = (planRes.data?.week_number ?? 0) + 1;

  const { data: plan, error: planErr } = await coachA.client
    .from('coaching_weekly_plans')
    .insert({
      enrollment_id: enrollmentId,
      week_number: nextWeek,
      title: `Slice 02 Week ${nextWeek}`,
      focus: 'dashboard',
      coach_message: 'Cố lên nhé!',
      status: 'active',
    })
    .select('*')
    .single();
  if (planErr) throw new Error(`create plan: ${errText(planErr)}`);

  async function mkTask(obj) {
    const { data, error } = await coachA.client
      .from('coaching_tasks')
      .insert({ weekly_plan_id: plan.id, ...obj })
      .select('*')
      .single();
    if (error) throw new Error(`create task: ${errText(error)}`);
    return data;
  }
  const past = new Date(Date.now() - 3 * 864e5).toISOString();
  const t1 = await mkTask({ task_type: 'text', title: `T1 revision ${Date.now()}`, instructions: 'x', sequence: 1, is_required: true });
  const t2 = await mkTask({ task_type: 'text', title: `T2 submitted ${Date.now()}`, instructions: 'x', sequence: 2, is_required: true });
  const t3 = await mkTask({ task_type: 'file', title: `T3 optional ${Date.now()}`, instructions: 'x', sequence: 3, is_required: false });
  const t4 = await mkTask({ task_type: 'checkoff', title: `T4 reviewed ${Date.now()}`, instructions: 'x', sequence: 4, is_required: true });
  const t5 = await mkTask({ task_type: 'text', title: `T5 overdue ${Date.now()}`, instructions: 'x', sequence: 5, is_required: true, due_at: past });

  /* ---------------- Setup: roadmap + items (Coach A) ---------------- */
  const { data: roadmap, error: rmErr } = await coachA.client
    .from('coaching_roadmaps')
    .insert({ enrollment_id: enrollmentId, title: `Slice 02 Roadmap ${Date.now()}` })
    .select('*')
    .single();
  if (rmErr) fail('14. Coach A roadmap create/edit', 'insert roadmap', errText(rmErr));

  let roadmapId = roadmap?.id ?? null;
  let item1 = null;
  let item2 = null;
  let item3 = null;
  if (roadmapId) {
    const mkItem = async (title, sequence, status) => {
      const { data, error } = await coachA.client
        .from('coaching_roadmap_items')
        .insert({ roadmap_id: roadmapId, title, description: '', sequence, status })
        .select('*')
        .single();
      if (error) throw new Error(`create item: ${errText(error)}`);
      return data;
    };
    item1 = await mkItem('Chặng 1', 1, 'completed');
    item2 = await mkItem('Chặng 2', 2, 'in_progress');
    item3 = await mkItem('Chặng 3', 3, 'locked');

    // Edit roadmap title (Coach permission).
    const { data: rmUp, error: rmUpErr } = await coachA.client
      .from('coaching_roadmaps')
      .update({ title: `Slice 02 Roadmap edited ${Date.now()}` })
      .eq('id', roadmapId)
      .select('*')
      .single();
    if (!rmUpErr && rmUp) pass('14. Coach A roadmap create/edit', 'created + edited title', rmUp.title);
    else fail('14. Coach A roadmap create/edit', 'edit title', errText(rmUpErr));

    // Update item status (Coach permission).
    const { data: itUp, error: itUpErr } = await coachA.client
      .from('coaching_roadmap_items')
      .update({ status: 'completed' })
      .eq('id', item3.id)
      .select('*')
      .single();
    if (!itUpErr && itUp?.status === 'completed')
      pass('15. Coach A roadmap item status update', 'locked -> completed', itUp.status);
    else fail('15. Coach A roadmap item status update', 'item update', errText(itUpErr));
    await coachA.client
      .from('coaching_roadmap_items')
      .update({ status: 'locked' })
      .eq('id', item3.id);
  }

  /* ---------------- Setup: submissions ---------------- */
  const submitAs = async (task, status = 'submitted') => {
    const { data, error } = await studentA.client
      .from('coaching_submissions')
      .insert({
        task_id: task.id,
        student_id: studentAId,
        text_response: task.task_type === 'checkoff' ? null : 'answer',
        storage_path: null,
        duration_seconds: null,
        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();
    if (error) throw new Error(`submit ${task.id}: ${errText(error)}`);
    return data;
  };
  const sub1 = await submitAs(t1); // -> revision_requested
  const sub2 = await submitAs(t2); // -> submitted (awaiting review)
  const sub4 = await submitAs(t4); // -> reviewed

  // Coach A requests revision on t1.
  await coachA.client.rpc('review_coaching_submission', {
    p_submission_id: sub1.id,
    p_feedback_text: 'Sửa lại nhé',
    p_feedback_score: null,
    p_feedback_data: {},
    p_request_revision: true,
  });
  // Coach A completes review on t4.
  await coachA.client.rpc('review_coaching_submission', {
    p_submission_id: sub4.id,
    p_feedback_text: 'Tốt lắm',
    p_feedback_score: 90,
    p_feedback_data: {},
    p_request_revision: false,
  });

  const taskIds = [t1.id, t2.id, t3.id, t4.id, t5.id];

  /* =================================================================
   * STUDENT A
   * ================================================================ */
  // 4. This Week tasks/statuses (data layer that the UI renders).
  {
    const { data: tasks, error } = await studentA.client
      .from('coaching_tasks')
      .select('*')
      .eq('weekly_plan_id', plan.id)
      .order('sequence', { ascending: true });
    const { data: subs } = await studentA.client
      .from('coaching_submissions')
      .select('task_id,status')
      .in('task_id', taskIds);
    const byTask = new Map((subs ?? []).map((s) => [s.task_id, s.status]));
    const expect = { [t1.id]: 'revision_requested', [t2.id]: 'submitted', [t4.id]: 'reviewed' };
    const okRows =
      !error &&
      tasks?.length === 5 &&
      (byTask.get(t1.id) === expect[t1.id]) &&
      (byTask.get(t2.id) === expect[t2.id]) &&
      (byTask.get(t4.id) === expect[t4.id]) &&
      !byTask.has(t3.id) &&
      !byTask.has(t5.id);
    if (okRows) pass('4. Student A This Week data', '5 tasks, statuses correct');
    else fail('4. Student A This Week data', 'task/status mismatch', JSON.stringify({ n: tasks?.length, s: subs }));
  }

  // 5. Goal uses actual enrollment data.
  {
    const { data } = await studentA.client
      .from('coaching_enrollments')
      .select('program,goal_label,baseline_data,target_data,target_date')
      .eq('id', enrollmentId)
      .maybeSingle();
    if (data && data.baseline_data?.overall === 450 && data.target_data?.overall === 600 && data.target_date)
      pass('5. Student A Goal data', `baseline=${data.baseline_data.overall} target=${data.target_data.overall}`);
    else fail('5. Student A Goal data', 'enrollment goal fields', JSON.stringify(data));
  }

  // 6. Roadmap renders stages/statuses (data readable by student, correct order/status).
  {
    const { data: rms } = await studentA.client
      .from('coaching_roadmaps')
      .select('*')
      .eq('id', roadmapId);
    const { data: items, error: itErr } = await studentA.client
      .from('coaching_roadmap_items')
      .select('*')
      .eq('roadmap_id', roadmapId)
      .order('sequence', { ascending: true });
    const okRoadmap =
      !itErr &&
      rms?.length === 1 &&
      items?.length === 3 &&
      items[0].status === 'completed' &&
      items[1].status === 'in_progress' &&
      items[2].status === 'locked';
    if (okRoadmap) pass('6. Student A Roadmap data', 'roadmap + 3 ordered stages');
    else fail('6. Student A Roadmap data', 'roadmap/items', JSON.stringify({ rms: rms?.length, items }));
  }

  // 7. Progress calculations match underlying data.
  {
    const { data: tasks } = await studentA.client
      .from('coaching_tasks')
      .select('id,is_required')
      .in('weekly_plan_id', [plan.id]);
    const { data: subs } = await studentA.client
      .from('coaching_submissions')
      .select('task_id,status')
      .in('task_id', taskIds);
    const statusByTask = new Map((subs ?? []).map((s) => [s.task_id, s.status]));
    const required = (tasks ?? []).filter((t) => t.is_required);
    const reviewedRequired = required.filter((t) => statusByTask.get(t.id) === 'reviewed');
    // expected: required = t1,t2,t4,t5 (4); reviewed required = t4 (1)
    if (required.length === 4 && reviewedRequired.length === 1)
      pass('7. Progress formula data', `required=${required.length} reviewed=${reviewedRequired.length}`);
    else fail('7. Progress formula data', 'progress inputs', JSON.stringify({ required: required.length, reviewed: reviewedRequired.length }));
  }

  // 2 (data prerequisite): a revision_requested task exists alongside incomplete tasks.
  {
    const { data: subs } = await studentA.client
      .from('coaching_submissions')
      .select('task_id,status')
      .in('task_id', taskIds);
    const hasRevision = (subs ?? []).some((s) => s.status === 'revision_requested');
    if (hasRevision) info('2. Primary action priority (UI)', 'revision_requested task present; UI ordering verified separately');
    else fail('2. Primary action priority (UI)', 'no revision_requested task to rank');
  }

  // 1 & 3 & 8: UI-only
  skip('1. Primary action (UI)', 'rendered primary card', 'requires browser UI');
  skip('3. Submitted not shown as student work (UI)', 'waiting card', 'requires browser UI');
  skip('8. Empty states (UI)', 'rendered empty states', 'requires browser UI');

  /* =================================================================
   * COACH A
   * ================================================================ */
  // 9. Assigned learner appears.
  {
    const { data, error } = await coachA.client
      .from('coaching_enrollments')
      .select('id')
      .eq('coach_id', coachAId)
      .eq('id', enrollmentId);
    if (!error && data?.length === 1) ok('9. Coach A assigned learner', 'enrollment visible');
    else fail('9. Coach A assigned learner', errText(error) || JSON.stringify(data));
  }
  // 10/11/12. Counts across Coach A's learners (data the dashboard aggregates).
  {
    const { data: ens } = await coachA.client.from('coaching_enrollments').select('id');
    const enIds = (ens ?? []).map((e) => e.id);
    const { data: plans } = await coachA.client
      .from('coaching_weekly_plans')
      .select('id,enrollment_id')
      .in('enrollment_id', enIds);
    const { data: tasks } = await coachA.client
      .from('coaching_tasks')
      .select('id,weekly_plan_id,is_required')
      .in('weekly_plan_id', (plans ?? []).map((p) => p.id));
    const { data: subs } = await coachA.client
      .from('coaching_submissions')
      .select('id,task_id,status')
      .in('task_id', (tasks ?? []).map((t) => t.id));
    const taskStatus = new Map((subs ?? []).map((s) => [s.task_id, s.status]));
    const ourTasks = (tasks ?? []).filter((t) => taskIds.includes(t.id));
    const pending = ourTasks.filter((t) => taskStatus.get(t.id) === 'submitted').length;
    const revision = ourTasks.filter((t) => taskStatus.get(t.id) === 'revision_requested').length;
    const incompleteRequired = ourTasks.filter(
      (t) => t.is_required && (!taskStatus.has(t.id) || taskStatus.get(t.id) === 'draft')
    ).length;
    if (pending === 1) pass('10. Coach A pending-review count', `pending=${pending}`);
    else fail('10. Coach A pending-review count', `expected 1 got ${pending}`);
    if (revision === 1) pass('11. Coach A revision-requested', `revision=${revision}`);
    else fail('11. Coach A revision-requested', `expected 1 got ${revision}`);
    // t5 required + overdue + incomplete
    if (incompleteRequired === 1) info('12. Overdue/incomplete detection', `incompleteRequired=${incompleteRequired} (t5 overdue)`);
    else fail('12. Overdue/incomplete detection', `expected 1 got ${incompleteRequired}`);
  }
  skip('13. Attention ordering (UI)', 'deterministic ordering', 'requires browser UI');
  skip('12b. Learner without weekly plan', 'not applicable in this fixture', 'Student A has an active plan');

  /* =================================================================
   * SECURITY
   * ================================================================ */
  const denied = (data) => !data || data.length === 0;

  // 16. Student B cannot read Student A roadmap/dashboard data.
  {
    const checks = [];
    const r1 = await studentB.client.from('coaching_roadmaps').select('id').eq('id', roadmapId);
    checks.push(['roadmaps', r1.error ? 'err' : denied(r1.data)]);
    const r2 = await studentB.client.from('coaching_roadmap_items').select('id').eq('roadmap_id', roadmapId);
    checks.push(['roadmap_items', r2.error ? 'err' : denied(r2.data)]);
    const r3 = await studentB.client.from('coaching_weekly_plans').select('id').eq('id', plan.id);
    checks.push(['plans', r3.error ? 'err' : denied(r3.data)]);
    const r4 = await studentB.client.from('coaching_tasks').select('id').in('id', taskIds);
    checks.push(['tasks', r4.error ? 'err' : denied(r4.data)]);
    const r5 = await studentB.client.from('coaching_submissions').select('id').in('id', [sub1.id, sub2.id, sub4.id]);
    checks.push(['submissions', r5.error ? 'err' : denied(r5.data)]);
    const allDenied = checks.every(([, v]) => v === 'err' || v === true);
    if (allDenied) deny('16. Student B denied Student A data', JSON.stringify(checks));
    else fail('16. Student B denied Student A data', 'leak', JSON.stringify(checks));
  }

  // 17. Coach B cannot read Student A roadmap/dashboard data.
  {
    const checks = [];
    const r1 = await coachB.client.from('coaching_roadmaps').select('id').eq('id', roadmapId);
    checks.push(['roadmaps', r1.error ? 'err' : denied(r1.data)]);
    const r2 = await coachB.client.from('coaching_roadmap_items').select('id').eq('roadmap_id', roadmapId);
    checks.push(['roadmap_items', r2.error ? 'err' : denied(r2.data)]);
    const r3 = await coachB.client.from('coaching_weekly_plans').select('id').eq('id', plan.id);
    checks.push(['plans', r3.error ? 'err' : denied(r3.data)]);
    const r4 = await coachB.client.from('coaching_submissions').select('id').in('id', [sub1.id, sub2.id, sub4.id]);
    checks.push(['submissions', r4.error ? 'err' : denied(r4.data)]);
    const allDenied = checks.every(([, v]) => v === 'err' || v === true);
    if (allDenied) deny('17. Coach B denied Student A data', JSON.stringify(checks));
    else fail('17. Coach B denied Student A data', 'leak', JSON.stringify(checks));
  }

  // 18. Direct access by enrollment id does not leak.
  {
    const b = await coachB.client.from('coaching_enrollments').select('id').eq('id', enrollmentId);
    const s = await studentB.client.from('coaching_enrollments').select('id').eq('id', enrollmentId);
    const bDenied = b.error ? 'err' : denied(b.data);
    const sDenied = s.error ? 'err' : denied(s.data);
    if (bDenied === 'err' || bDenied === true) {
      if (sDenied === 'err' || sDenied === true) deny('18. Direct access denied', 'coachB + studentB');
      else fail('18. Direct access denied', 'studentB saw enrollment');
    } else fail('18. Direct access denied', 'coachB saw enrollment');
  }

  info('19. No service-role in tests', 'harness uses anon key + per-user JWT only');

  /* =================================================================
   * REGRESSION
   * ================================================================ */
  // 20. Student submission still works (sub2 is status submitted).
  if (sub2.status === 'submitted') pass('20. Student submission works', `sub2=${sub2.status}`);
  else fail('20. Student submission works', `sub2=${sub2.status}`);

  // 21. Coach review still works (sub4 reviewed by RPC).
  {
    const { data } = await coachA.client
      .from('coaching_submissions')
      .select('status,feedback_text,feedback_score')
      .eq('id', sub4.id)
      .maybeSingle();
    if (data?.status === 'reviewed' && data.feedback_score === 90)
      pass('21. Coach review works', `status=${data.status}`);
    else fail('21. Coach review works', JSON.stringify(data));
  }

  // 22. Revision history still loads for the reviewed submission.
  {
    const { data, error } = await studentA.client
      .from('coaching_submission_revisions')
      .select('id,revision_number')
      .eq('submission_id', sub4.id);
    if (!error && data?.length >= 1) pass('22. Revision history loads', `count=${data.length}`);
    else fail('22. Revision history loads', errText(error) || 'no revisions');
  }

  /* ---------------- OUTPUT ---------------- */
  const sections = [...new Set(results.map((r) => r.section))];
  for (const sec of sections) {
    console.log(`\n## ${sec}`);
    for (const r of results.filter((x) => x.section === sec)) {
      console.log(`  [${r.status}] ${r.name}${r.evidence ? ` — ${r.evidence}` : ''}`);
    }
  }
  const executed = results.filter((r) => r.status === 'PASS' || r.status === 'FAIL');
  console.log(
    `\n===== SLICE 02 (API/data): ${executed.length - fails}/${executed.length} executed checks passed, ${fails} failed =====`
  );
  console.log('IDS ' + JSON.stringify({ enrollmentId, planId: plan.id, roadmapId }));
  if (fails > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[FATAL]', e?.message ?? e);
  process.exit(1);
});
