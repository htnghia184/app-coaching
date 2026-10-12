#!/usr/bin/env node
/**
 * E-Master Coaching — SLICE 01.1 TARGETED REGRESSION (submission revision + feedback history).
 *
 * ADMIN/TEST TOOLING ONLY (never browser code). Uses ONLY the public/anon key +
 * normal per-user signInWithPassword sessions, so every query/RPC/storage call is
 * subject to the same RLS/JWT rules as a real user. NEVER uses the service-role key.
 *
 * Scope: the 13 functional checks of Slice 01.1 only (typecheck/build are run
 * separately). This is intentionally NOT the full 59-check Vertical Slice 01 suite.
 *
 * Usage:
 *   node --env-file=.env --env-file=scripts/.env.test scripts/e2e-slice-011.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const PASSWORD = process.env.TEST_USER_PASSWORD;

const BUCKET = 'coaching-submissions';

const results = [];
let fails = 0;
function record(section, name, status, evidence = '') {
  if (status === 'FAIL') fails++;
  results.push({ section, name, status, evidence: String(evidence).slice(0, 400) });
}
const pass = (s, n, e) => record(s, n, 'PASS', e);
const fail = (s, n, e) => record(s, n, 'FAIL', e);
const info = (s, n, e) => record(s, n, 'INFO', e);

function client() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(email) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { client: c, user: data.user };
}
const row = (d) => (Array.isArray(d) ? (d[0] ?? null) : d);
const errText = (e) => (e ? `${e.code ?? ''} ${e.message ?? ''}`.trim() : '');

async function main() {
  if (!URL || !ANON || !PASSWORD) {
    console.error('Missing env (SUPABASE_URL/VITE_SUPABASE_URL, anon/publishable key, TEST_USER_PASSWORD).');
    process.exit(1);
  }

  const admin = await signIn('admin-test@e-master.vn');
  const coachA = await signIn('teacher2@e-master.vn');
  const coachB = await signIn('teacher3@e-master.vn');
  const studentA = await signIn('student2@e-master.vn');
  const studentB = await signIn('student3@e-master.vn');
  const [coachAId, studentAId, studentBId] = [coachA.user.id, studentA.user.id, studentB.user.id];

  // ---- Setup: Student A -> Coach A enrollment ----
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
        goal_label: 'Slice 01.1',
        baseline_data: { overall: 450 },
        target_data: { overall: 600 },
        status: 'active',
      })
      .select('*')
      .single();
    if (error) throw new Error(`create enrollment: ${errText(error)}`);
    enrollmentId = data.id;
  }
  info('Setup', 'enrollment', enrollmentId);

  // ---- Setup: fresh plan + text/file tasks (guarantees a brand-new submission) ----
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
      title: `Slice 01.1 History ${Date.now()}`,
      focus: 'revision history',
      coach_message: '',
      status: 'active',
    })
    .select('*')
    .single();
  if (planErr) throw new Error(`create plan: ${errText(planErr)}`);

  const { data: textTask, error: textTaskErr } = await coachA.client
    .from('coaching_tasks')
    .insert({
      weekly_plan_id: plan.id,
      task_type: 'text',
      title: `History Text ${Date.now()}`,
      instructions: 'Slice 01.1 revision-history check.',
      sequence: 1,
      is_required: true,
    })
    .select('*')
    .single();
  if (textTaskErr) throw new Error(`create text task: ${errText(textTaskErr)}`);

  const { data: fileTask, error: fileTaskErr } = await coachA.client
    .from('coaching_tasks')
    .insert({
      weekly_plan_id: plan.id,
      task_type: 'file',
      title: `History File ${Date.now()}`,
      instructions: 'Slice 01.1 file-revision check.',
      sequence: 2,
      is_required: false,
    })
    .select('*')
    .single();
  if (fileTaskErr) throw new Error(`create file task: ${errText(fileTaskErr)}`);

  const TEXT_V1 = 'My original answer';
  const TEXT_V2 = 'My revised answer';
  const FB1 = 'Please revise sentence 4';
  const FB2 = 'Revision accepted';

  /* =================================================================
   * STEP 1 — Student A submits V1
   * ================================================================ */
  let submissionId = null;
  let rev1 = null;
  {
    const { data, error } = await studentA.client
      .from('coaching_submissions')
      .insert({
        task_id: textTask.id,
        student_id: studentAId,
        text_response: TEXT_V1,
        storage_path: null,
        duration_seconds: null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      fail('1. Student submits V1', 'insert submission', errText(error));
    } else {
      submissionId = data.id;
      const { data: revs, error: rErr } = await studentA.client
        .from('coaching_submission_revisions')
        .select('*')
        .eq('submission_id', submissionId)
        .order('revision_number', { ascending: true });
      rev1 = row(revs);
      if (rErr) fail('1. Student submits V1', 'read history', errText(rErr));
      else if (revs?.length === 1 && rev1.revision_number === 1 && rev1.text_response === TEXT_V1 && rev1.review_status === 'pending')
        pass('1. Student submits V1', 'rev1 created (pending, correct text)', `rev=${rev1.revision_number}`);
      else fail('1. Student submits V1', 'rev1 created', JSON.stringify(revs));
    }
  }

  /* =================================================================
   * STEP 2 — Coach A feedback #1 + request revision
   * ================================================================ */
  {
    const { data, error } = await coachA.client.rpc('review_coaching_submission', {
      p_submission_id: submissionId,
      p_feedback_text: FB1,
      p_feedback_score: null,
      p_feedback_data: {},
      p_request_revision: true,
    });
    const r = row(data);
    if (error) fail('2. Coach A request revision', 'review #1', errText(error));
    else if (r.status === 'revision_requested') pass('2. Coach A request revision', 'submission status', r.status);
    else fail('2. Coach A request revision', 'submission status', `got ${r.status}`);

    const { data: after } = await coachA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', submissionId)
      .eq('revision_number', 1)
      .maybeSingle();
    if (after?.review_status === 'revision_requested' && after.feedback_text === FB1 && after.reviewed_at)
      pass('2. Coach A request revision', 'rev1 review attached', `status=${after.review_status}`);
    else fail('2. Coach A request revision', 'rev1 review attached', JSON.stringify(after));
  }

  /* =================================================================
   * STEP 3 — Student A sees feedback #1
   * ================================================================ */
  {
    const { data } = await studentA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', submissionId)
      .eq('revision_number', 1)
      .maybeSingle();
    if (data?.feedback_text === FB1) pass('3. Student A sees feedback #1', 'rev1 feedback visible');
    else fail('3. Student A sees feedback #1', 'rev1 feedback', JSON.stringify(data?.feedback_text));
  }

  /* =================================================================
   * STEP 4 — Student A submits V2
   * ================================================================ */
  let rev2 = null;
  {
    const { data, error } = await studentA.client.rpc('update_own_coaching_submission', {
      p_submission_id: submissionId,
      p_text_response: TEXT_V2,
      p_storage_path: null,
      p_duration_seconds: null,
      p_submit: true,
    });
    const r = row(data);
    if (error) fail('4. Student submits V2', 'resubmit via RPC', errText(error));
    else if (r.status === 'submitted' && r.text_response === TEXT_V2)
      pass('4. Student submits V2', 'current state moved forward', `status=${r.status}`);
    else fail('4. Student submits V2', 'current state moved forward', JSON.stringify({ status: r.status }));

    const { data: revs } = await studentA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', submissionId)
      .order('revision_number', { ascending: true });
    rev2 = row((revs ?? []).filter((x) => x.revision_number === 2));
    if (revs?.length === 2 && rev2?.text_response === TEXT_V2 && rev2?.review_status === 'pending')
      pass('4. Student submits V2', 'rev2 created (pending)', `count=${revs.length}`);
    else fail('4. Student submits V2', 'rev2 created', JSON.stringify(revs));
  }

  /* =================================================================
   * STEP 5 — Coach A sees V1 + feedback #1 in history
   * ================================================================ */
  {
    const { data } = await coachA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', submissionId)
      .order('revision_number', { ascending: true });
    const v1 = (data ?? []).find((r) => r.revision_number === 1);
    const v2 = (data ?? []).find((r) => r.revision_number === 2);
    if (data?.length === 2 && v1?.text_response === TEXT_V1 && v1?.feedback_text === FB1 && v2?.text_response === TEXT_V2)
      pass('5. Coach A sees V1 + feedback #1', 'both revisions visible', `count=${data.length}`);
    else fail('5. Coach A sees V1 + feedback #1', 'both revisions visible', JSON.stringify(data));
  }

  /* =================================================================
   * STEP 6 — Coach A reviews V2 with feedback #2
   * ================================================================ */
  {
    const { data, error } = await coachA.client.rpc('review_coaching_submission', {
      p_submission_id: submissionId,
      p_feedback_text: FB2,
      p_feedback_score: 90,
      p_feedback_data: {},
      p_request_revision: false,
    });
    const r = row(data);
    if (error) fail('6. Coach A reviews V2', 'review #2', errText(error));
    else if (r.status === 'reviewed' && r.feedback_score === 90)
      pass('6. Coach A reviews V2', 'submission reviewed', `status=${r.status}`);
    else fail('6. Coach A reviews V2', 'submission reviewed', JSON.stringify({ status: r.status }));

    const { data: v2 } = await coachA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', submissionId)
      .eq('revision_number', 2)
      .maybeSingle();
    if (v2?.review_status === 'reviewed' && v2?.feedback_text === FB2 && v2?.feedback_score === 90)
      pass('6. Coach A reviews V2', 'rev2 review attached', `status=${v2.review_status}`);
    else fail('6. Coach A reviews V2', 'rev2 review attached', JSON.stringify(v2));
  }

  /* =================================================================
   * STEP 7 — Student A sees V2+fb#2 and V1+fb#1
   * ================================================================ */
  let finalV1 = null;
  {
    const { data } = await studentA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', submissionId)
      .order('revision_number', { ascending: true });
    const v1 = (data ?? []).find((r) => r.revision_number === 1);
    const v2 = (data ?? []).find((r) => r.revision_number === 2);
    finalV1 = v1;
    const okV2 = v2?.feedback_text === FB2 && v2?.review_status === 'reviewed';
    const okV1 = v1?.feedback_text === FB1 && v1?.review_status === 'revision_requested';
    if (okV1 && okV2) pass('7. Student sees V2+fb#2 & V1+fb#1', 'both versions reconstruct', `count=${data?.length}`);
    else fail('7. Student sees V2+fb#2 & V1+fb#1', 'both versions reconstruct', JSON.stringify({ okV1, okV2 }));
  }

  /* =================================================================
   * STEP 8 — V1 student content unchanged
   * ================================================================ */
  if (finalV1?.text_response === TEXT_V1)
    pass('8. V1 student content unchanged', 'text_response immutable', TEXT_V1);
  else fail('8. V1 student content unchanged', 'text_response', JSON.stringify(finalV1?.text_response));

  /* =================================================================
   * STEP 9 — feedback #1 unchanged
   * ================================================================ */
  if (finalV1?.feedback_text === FB1 && finalV1?.review_status === 'revision_requested')
    pass('9. Feedback #1 unchanged', 'canonical review intact', FB1);
  else fail('9. Feedback #1 unchanged', 'canonical review', JSON.stringify(finalV1?.feedback_text));

  /* =================================================================
   * STEP 10 — Student B cannot SELECT Student A history
   * ================================================================ */
  {
    const { data, error } = await studentB.client
      .from('coaching_submission_revisions')
      .select('id')
      .eq('submission_id', submissionId);
    if (error || (data ?? []).length === 0) pass('10. Student B denied', errText(error) || '0 rows');
    else fail('10. Student B denied', 'rows visible', JSON.stringify(data));
  }

  /* =================================================================
   * STEP 11 — Coach B cannot SELECT Student A history
   * ================================================================ */
  {
    const { data, error } = await coachB.client
      .from('coaching_submission_revisions')
      .select('id')
      .eq('submission_id', submissionId);
    if (error || (data ?? []).length === 0) pass('11. Coach B denied', errText(error) || '0 rows');
    else fail('11. Coach B denied', 'rows visible', JSON.stringify(data));
  }

  /* =================================================================
   * STEP 12 — Student/Coach cannot directly UPDATE/DELETE history
   * ================================================================ */
  {
    // Student A direct UPDATE (feedback)
    const sUp = await studentA.client
      .from('coaching_submission_revisions')
      .update({ feedback_text: 'HACK', text_response: 'HACK' })
      .eq('submission_id', submissionId)
      .select('id');
    if (sUp.error || (sUp.data ?? []).length === 0)
      pass('12a. Student direct UPDATE denied', errText(sUp.error) || '0 rows');
    else fail('12a. Student direct UPDATE denied', 'UPDATE succeeded');

    // Student A direct DELETE
    const sDel = await studentA.client
      .from('coaching_submission_revisions')
      .delete()
      .eq('id', rev1?.id ?? '')
      .select('id');
    if (sDel.error || (sDel.data ?? []).length === 0)
      pass('12b. Student direct DELETE denied', errText(sDel.error) || '0 rows');
    else fail('12b. Student direct DELETE denied', 'DELETE succeeded');

    // Coach A direct UPDATE
    const cUp = await coachA.client
      .from('coaching_submission_revisions')
      .update({ feedback_text: 'HACK' })
      .eq('submission_id', submissionId)
      .select('id');
    if (cUp.error || (cUp.data ?? []).length === 0)
      pass('12c. Coach direct UPDATE denied', errText(cUp.error) || '0 rows');
    else fail('12c. Coach direct UPDATE denied', 'UPDATE succeeded');

    // Coach A direct DELETE
    const cDel = await coachA.client
      .from('coaching_submission_revisions')
      .delete()
      .eq('submission_id', submissionId)
      .select('id');
    if (cDel.error || (cDel.data ?? []).length === 0)
      pass('12d. Coach direct DELETE denied', errText(cDel.error) || '0 rows');
    else fail('12d. Coach direct DELETE denied', 'DELETE succeeded');

    // Student A direct INSERT
    const sIns = await studentA.client
      .from('coaching_submission_revisions')
      .insert({
        submission_id: submissionId,
        task_id: textTask.id,
        student_id: studentAId,
        revision_number: 999,
        review_status: 'reviewed',
      })
      .select('id');
    if (sIns.error || (sIns.data ?? []).length === 0)
      pass('12e. Student direct INSERT denied', errText(sIns.error) || '0 rows');
    else fail('12e. Student direct INSERT denied', 'INSERT succeeded');

    // Confirm history was not mutated by any of the above
    const { data: intact } = await admin.client
      .from('coaching_submission_revisions')
      .select('revision_number,text_response,feedback_text,review_status')
      .eq('submission_id', submissionId)
      .order('revision_number', { ascending: true });
    const ok =
      intact?.length === 2 &&
      intact[0].text_response === TEXT_V1 &&
      intact[0].feedback_text === FB1 &&
      intact[1].text_response === TEXT_V2 &&
      intact[1].feedback_text === FB2;
    if (ok) pass('12f. History intact after attacks', 'no unauthorized mutation');
    else fail('12f. History intact after attacks', JSON.stringify(intact));
  }

  /* =================================================================
   * STEP 13 — Historical private file remains accessible
   * ================================================================ */
  {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64'
    );
    const path1 = `${studentAId}/${fileTask.id}/${Date.now()}-a.png`;
    const path2 = `${studentAId}/${fileTask.id}/${Date.now()}-b.png`;

    const up1 = await studentA.client.storage.from(BUCKET).upload(path1, png, { contentType: 'image/png', upsert: false });
    if (up1.error) fail('13. Historical file', 'upload v1', errText(up1.error));
    const { data: fileSub } = await studentA.client
      .from('coaching_submissions')
      .insert({
        task_id: fileTask.id,
        student_id: studentAId,
        text_response: null,
        storage_path: path1,
        duration_seconds: null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    const up2 = await studentA.client.storage.from(BUCKET).upload(path2, png, { contentType: 'image/png', upsert: false });
    if (up2.error) fail('13. Historical file', 'upload v2', errText(up2.error));
    const { error: resubErr } = await studentA.client.rpc('update_own_coaching_submission', {
      p_submission_id: fileSub.id,
      p_text_response: null,
      p_storage_path: path2,
      p_duration_seconds: null,
      p_submit: true,
    });
    if (resubErr) fail('13. Historical file', 'resubmit with new file', errText(resubErr));

    const { data: revs } = await studentA.client
      .from('coaching_submission_revisions')
      .select('*')
      .eq('submission_id', fileSub.id)
      .order('revision_number', { ascending: true });
    const f1 = (revs ?? []).find((r) => r.revision_number === 1);
    const f2 = (revs ?? []).find((r) => r.revision_number === 2);
    if (f1?.storage_path === path1 && f2?.storage_path === path2)
      pass('13a. File history reconstructs', 'rev1->path1, rev2->path2');
    else fail('13a. File history reconstructs', JSON.stringify({ p1: f1?.storage_path, p2: f2?.storage_path }));

    const sA = await studentA.client.storage.from(BUCKET).createSignedUrl(path1, 60);
    const cA = await coachA.client.storage.from(BUCKET).createSignedUrl(path1, 60);
    if (!sA.error) pass('13b. Student A can access historical file', 'signed URL ok');
    else fail('13b. Student A can access historical file', errText(sA.error));
    if (!cA.error) pass('13c. Coach A can access historical file', 'signed URL ok');
    else fail('13c. Coach A can access historical file', errText(cA.error));

    const sB = await studentB.client.storage.from(BUCKET).createSignedUrl(path1, 60);
    if (sB.error) pass('13d. Student B denied historical file', errText(sB.error));
    else fail('13d. Student B denied historical file', 'signed URL issued');
  }

  /* ---------------- OUTPUT ---------------- */
  const sections = [...new Set(results.map((r) => r.section))];
  for (const sec of sections) {
    console.log(`\n## ${sec}`);
    for (const r of results.filter((x) => x.section === sec)) {
      console.log(`  [${r.status}] ${r.name}${r.evidence ? ` — ${r.evidence}` : ''}`);
    }
  }
  const total = results.filter((r) => r.status !== 'INFO').length;
  console.log(`\n===== SLICE 01.1: ${total - fails}/${total} checks passed, ${fails} failed =====`);
  console.log('IDS ' + JSON.stringify({ enrollmentId, planId: plan.id, textTaskId: textTask.id, submissionId }));
  if (fails > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[FATAL]', e?.message ?? e);
  process.exit(1);
});
