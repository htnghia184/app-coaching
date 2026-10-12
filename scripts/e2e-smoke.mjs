#!/usr/bin/env node
/**
 * E-Master Coaching — Vertical Slice 01 E2E + RLS/security smoke test harness.
 *
 * ADMIN/TEST TOOLING ONLY (never browser code). Uses ONLY the public/anon key
 * plus normal per-user signInWithPassword sessions, so every query/RPC/storage
 * call is subject to the same RLS/JWT rules as a real user. It NEVER uses the
 * service-role key.
 *
 * Usage:
 *   node --env-file=.env --env-file=scripts/.env.test scripts/e2e-smoke.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const PASSWORD = process.env.TEST_USER_PASSWORD;

const BUCKET = 'coaching-submissions';
const ENROLL_SELECT =
  '*, student:profiles!coaching_enrollments_student_id_fkey(id,email,full_name), ' +
  'coach:profiles!coaching_enrollments_coach_id_fkey(id,email,full_name)';

const results = [];
let fails = 0;
function record(section, name, status, evidence = '') {
  if (status === 'FAIL') fails++;
  results.push({ section, name, status, evidence: String(evidence).slice(0, 400) });
}
function pass(section, name, evidence) { record(section, name, 'PASS', evidence); }
function fail(section, name, evidence) { record(section, name, 'FAIL', evidence); }
function info(section, name, evidence) { record(section, name, 'INFO', evidence); }

function client() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(email) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { client: c, user: data.user };
}
function row(d) { return Array.isArray(d) ? (d[0] ?? null) : d; }
function errText(e) { return e ? `${e.code ?? ''} ${e.message ?? ''}`.trim() : ''; }

async function main() {
  if (!URL || !ANON || !PASSWORD) {
    console.error('Missing env (SUPABASE_URL/VITE_SUPABASE_URL, anon/publishable key, TEST_USER_PASSWORD).');
    process.exit(1);
  }

  // ---------------- PHASE 0: PRE-FLIGHT ----------------
  const admin = await signIn('admin-test@e-master.vn');
  const coachA = await signIn('teacher2@e-master.vn');
  const coachB = await signIn('teacher3@e-master.vn');
  const studentA = await signIn('student2@e-master.vn');
  const studentB = await signIn('student3@e-master.vn');
  const [adminId, coachAId, coachBId, studentAId, studentBId] = [
    admin.user.id, coachA.user.id, coachB.user.id, studentA.user.id, studentB.user.id,
  ];

  const accounts = [
    ['admin-test@e-master.vn', admin, 'admin'],
    ['teacher2@e-master.vn', coachA, 'teacher'],
    ['teacher3@e-master.vn', coachB, 'teacher'],
    ['student2@e-master.vn', studentA, 'student'],
    ['student3@e-master.vn', studentB, 'student'],
  ];
  for (const [email, ctx, expectedRole] of accounts) {
    const { data } = await ctx.client.from('profiles').select('role,full_name').eq('id', ctx.user.id).maybeSingle();
    const role = data?.role;
    if (role === expectedRole) pass('Phase 0', `auth+role ${email}`, `role=${role}`);
    else fail('Phase 0', `auth+role ${email}`, `expected ${expectedRole}, got ${role}`);
  }

  // Reuse existing Student A -> Coach A enrollment if present.
  const { data: existing } = await admin.client
    .from('coaching_enrollments')
    .select('id, student_id, coach_id, program, created_at')
    .eq('student_id', studentAId).eq('coach_id', coachAId)
    .order('created_at', { ascending: false });
  let enrollmentId = existing?.[0]?.id ?? null;
  info('Phase 0', 'existing enrollment check', enrollmentId ? `reusing ${enrollmentId}` : 'none found');

  // ---------------- PHASE 1: POSITIVE CORE LOOP ----------------
  // A. ADMIN
  if (!enrollmentId) {
    const { data, error } = await admin.client
      .from('coaching_enrollments')
      .insert({
        student_id: studentAId, coach_id: coachAId, program: 'TOEIC', goal_label: 'TOEIC 600+',
        baseline_data: { overall: 450 }, target_data: { overall: 600 },
        target_date: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), status: 'active',
      })
      .select('*').single();
    if (error) fail('Phase 1A', 'admin create enrollment', errText(error));
    else { enrollmentId = data.id; pass('Phase 1A', 'admin create enrollment', `id=${enrollmentId}`); }
  } else {
    pass('Phase 1A', 'admin create enrollment', `reused id=${enrollmentId}`);
  }

  if (enrollmentId) {
    const { data, error } = await admin.client
      .from('coaching_enrollments').select(ENROLL_SELECT).eq('id', enrollmentId).maybeSingle();
    if (error) fail('Phase 1A', 'admin verify association', errText(error));
    else if (data?.student_id === studentAId && data?.coach_id === coachAId)
      pass('Phase 1A', 'admin verify association', `student=${studentAId.slice(0,8)} coach=${coachAId.slice(0,8)}`);
    else fail('Phase 1A', 'admin verify association', JSON.stringify(data));
  }

  // B. COACH A
  const { data: coachEnroll } = await coachA.client
    .from('coaching_enrollments').select(ENROLL_SELECT).eq('coach_id', coachAId);
  const mine = (coachEnroll ?? []).find((e) => e.id === enrollmentId);
  if (mine) pass('Phase 1B', 'coach dashboard sees Student A', `enrollment ${enrollmentId}`);
  else fail('Phase 1B', 'coach dashboard sees Student A', 'enrollment not returned');
  if ((coachEnroll ?? []).some((e) => e.student_id === studentBId))
    fail('Phase 1B', 'coach A must NOT see Student B', 'Student B visible');
  else pass('Phase 1B', 'coach A must NOT see Student B', 'not visible');

  if (mine?.student?.full_name === 'Student One')
    pass('Phase 1B', 'Student A real profile name visible', mine.student.full_name);
  else fail('Phase 1B', 'Student A real profile name visible', `got ${JSON.stringify(mine?.student)}`);

  let planId = null;
  {
    const { data } = await coachA.client.from('coaching_weekly_plans').select('*')
      .eq('enrollment_id', enrollmentId).eq('week_number', 1);
    if (data && data.length) planId = data[0].id;
  }
  if (!planId) {
    const { data, error } = await coachA.client.from('coaching_weekly_plans').insert({
      enrollment_id: enrollmentId, week_number: 1, title: 'Foundation Week',
      focus: 'Core TOEIC practice', coach_message: 'Complete the assigned work and submit it for review.',
      status: 'active',
    }).select('*').single();
    if (error) fail('Phase 1B', 'coach create Week 1 plan', errText(error));
    else { planId = data.id; pass('Phase 1B', 'coach create Week 1 plan', `id=${planId}`); }
  } else pass('Phase 1B', 'coach create Week 1 plan', `reused id=${planId}`);

  let textTaskId = null;
  if (planId) {
    const { data } = await coachA.client.from('coaching_tasks').select('*')
      .eq('weekly_plan_id', planId).eq('title', 'Introduce Yourself');
    if (data && data.length) textTaskId = data[0].id;
    if (!textTaskId) {
      const { data, error } = await coachA.client.from('coaching_tasks').insert({
        weekly_plan_id: planId, task_type: 'text', title: 'Introduce Yourself',
        instructions: 'Write five English sentences introducing yourself.',
        sequence: 1, is_required: true,
      }).select('*').single();
      if (error) fail('Phase 1B', 'coach create text task', errText(error));
      else { textTaskId = data.id; pass('Phase 1B', 'coach create text task', `id=${textTaskId}`); }
    } else pass('Phase 1B', 'coach create text task', `reused id=${textTaskId}`);
  }

  const TEXT_V1 =
    'My name is Student Two.\nI am learning English.\nI want to improve my TOEIC score.\n' +
    'I study English every day.\nMy target is 600 points.';
  const TEXT_V2 = TEXT_V1.replace('I study English every day.', 'I practise listening and reading every single day.');

  // C. STUDENT A
  let submissionId = null;
  {
    const { data } = await studentA.client.from('coaching_enrollments').select(ENROLL_SELECT)
      .eq('student_id', studentAId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.coach?.full_name === 'Teacher One') pass('Phase 1C', 'Student A sees Coach A real name', data.coach.full_name);
    else fail('Phase 1C', 'Student A sees Coach A real name', JSON.stringify(data?.coach));
    if (data?.id === enrollmentId) pass('Phase 1C', 'Student A sees correct enrollment', data.id);
    else fail('Phase 1C', 'Student A sees correct enrollment', `got ${data?.id}`);
  }
  {
    const { data } = await studentA.client.from('coaching_weekly_plans').select('id,week_number,title')
      .eq('enrollment_id', enrollmentId);
    if ((data ?? []).some((p) => p.id === planId)) pass('Phase 1C', 'Student A sees Week 1', 'week_number=1');
    else fail('Phase 1C', 'Student A sees Week 1', JSON.stringify(data));
  }
  {
    const { data } = await studentA.client.from('coaching_tasks').select('id,title')
      .in('weekly_plan_id', planId ? [planId] : []);
    if ((data ?? []).some((t) => t.id === textTaskId)) pass('Phase 1C', 'Student A sees text task', 'Introduce Yourself');
    else fail('Phase 1C', 'Student A sees text task', JSON.stringify(data));
  }

  if (textTaskId) {
    const { data: prior } = await studentA.client.from('coaching_submissions').select('*')
      .eq('task_id', textTaskId).eq('student_id', studentAId).maybeSingle();
    if (prior) submissionId = prior.id;
    if (!submissionId) {
      const { data, error } = await studentA.client.from('coaching_submissions').insert({
        task_id: textTaskId, student_id: studentAId, text_response: TEXT_V1,
        storage_path: null, duration_seconds: null, status: 'submitted', submitted_at: new Date().toISOString(),
      }).select('*').single();
      if (error) fail('Phase 1C', 'Student A submit text', errText(error));
      else { submissionId = data.id; pass('Phase 1C', 'Student A submit text', `status=${data.status}`); }
    } else pass('Phase 1C', 'Student A submit text', `reused id=${submissionId}`);
  }
  if (submissionId) {
    const { data } = await studentA.client.from('coaching_submissions').select('*').eq('id', submissionId).maybeSingle();
    if (data?.text_response === TEXT_V1 && data?.status === 'submitted')
      pass('Phase 1C', 'submission persists on reload', `status=${data.status}`);
    else fail('Phase 1C', 'submission persists on reload', `status=${data?.status}`);
  }

  // D. COACH A REVIEW #1
  let afterReview1 = null;
  if (submissionId) {
    const { data, error } = await coachA.client.rpc('review_coaching_submission', {
      p_submission_id: submissionId,
      p_feedback_text: 'Good start. Please revise sentence 4 and add more detail.',
      p_feedback_score: null, p_feedback_data: {}, p_request_revision: true,
    });
    const r = row(data);
    if (error) fail('Phase 1D', 'coach review #1 (request revision)', errText(error));
    else {
      afterReview1 = r;
      if (r.status === 'revision_requested') pass('Phase 1D', 'status = revision_requested', `status=${r.status}`);
      else fail('Phase 1D', 'status = revision_requested', `got ${r.status}`);
      if ((r.feedback_text ?? '').startsWith('Good start')) pass('Phase 1D', 'feedback visible', r.feedback_text.slice(0, 40));
      else fail('Phase 1D', 'feedback visible', JSON.stringify(r.feedback_text));
      if (r.text_response === TEXT_V1) pass('Phase 1D', 'review did NOT modify student response', 'unchanged');
      else fail('Phase 1D', 'review did NOT modify student response', 'text changed!');
    }
  }

  // E. STUDENT A REVISION
  if (submissionId) {
    const { data, error } = await studentA.client.rpc('update_own_coaching_submission', {
      p_submission_id: submissionId, p_text_response: TEXT_V2, p_storage_path: null,
      p_duration_seconds: null, p_submit: true,
    });
    const r = row(data);
    if (error) fail('Phase 1E', 'student resubmit via RPC', errText(error));
    else {
      if (r.status === 'submitted') pass('Phase 1E', 'status returns to submitted', `status=${r.status}`);
      else fail('Phase 1E', 'status returns to submitted', `got ${r.status}`);
      if (r.text_response === TEXT_V2) pass('Phase 1E', 'updated response persists', 'ok');
      else fail('Phase 1E', 'updated response persists', 'text mismatch');
      const fbUnchanged = r.feedback_text === afterReview1?.feedback_text;
      const ownerUnchanged = (r.reviewed_by ?? null) === (afterReview1?.reviewed_by ?? null)
        && (r.reviewed_at ?? null) === (afterReview1?.reviewed_at ?? null);
      if (fbUnchanged && ownerUnchanged) pass('Phase 1E', 'student cannot change feedback/reviewer fields', 'unchanged');
      else fail('Phase 1E', 'student cannot change feedback/reviewer fields', `fb=${fbUnchanged} owner=${ownerUnchanged}`);
    }
  }

  // F. COACH A FINAL REVIEW
  if (submissionId) {
    const { data, error } = await coachA.client.rpc('review_coaching_submission', {
      p_submission_id: submissionId, p_feedback_text: 'Revision accepted. Good work.',
      p_feedback_score: 85, p_feedback_data: {}, p_request_revision: false,
    });
    const r = row(data);
    if (error) fail('Phase 1F', 'coach final review', errText(error));
    else {
      if (r.status === 'reviewed') pass('Phase 1F', 'status = reviewed', `status=${r.status}`);
      else fail('Phase 1F', 'status = reviewed', `got ${r.status}`);
      if (r.reviewed_by === coachAId) pass('Phase 1F', 'reviewed_by = Coach A', r.reviewed_by);
      else fail('Phase 1F', 'reviewed_by = Coach A', `got ${r.reviewed_by}`);
      if (r.reviewed_at) pass('Phase 1F', 'reviewed_at exists', r.reviewed_at);
      else fail('Phase 1F', 'reviewed_at exists', 'null');
      if (r.text_response === TEXT_V2) pass('Phase 1F', 'student response unchanged by final review', 'unchanged');
      else fail('Phase 1F', 'student response unchanged by final review', 'text changed!');
    }
  }

  // G. STUDENT A FINAL STATE
  if (submissionId) {
    const { data } = await studentA.client.from('coaching_submissions').select('*').eq('id', submissionId).maybeSingle();
    if (data?.status === 'reviewed') pass('Phase 1G', 'Student A final status reviewed', `status=${data.status}`);
    else fail('Phase 1G', 'Student A final status reviewed', `got ${data?.status}`);
    if ((data?.feedback_text ?? '').includes('Revision accepted')) pass('Phase 1G', 'final feedback visible', data.feedback_text);
    else fail('Phase 1G', 'final feedback visible', JSON.stringify(data?.feedback_text));
  }

  // ---------------- PHASE 2: PRIVATE FILE ----------------
  let fileTaskId = null;
  if (planId) {
    const { data } = await coachA.client.from('coaching_tasks').select('*')
      .eq('weekly_plan_id', planId).eq('title', 'Upload Test File');
    if (data && data.length) fileTaskId = data[0].id;
    if (!fileTaskId) {
      const { data, error } = await coachA.client.from('coaching_tasks').insert({
        weekly_plan_id: planId, task_type: 'file', title: 'Upload Test File',
        instructions: 'Upload a small file.', sequence: 2, is_required: false,
      }).select('*').single();
      if (error) fail('Phase 2', 'coach create FILE task', errText(error));
      else { fileTaskId = data.id; pass('Phase 2', 'coach create FILE task', `id=${fileTaskId}`); }
    } else pass('Phase 2', 'coach create FILE task', `reused id=${fileTaskId}`);
  }

  let storagePath = null;
  if (fileTaskId) {
    // 1x1 PNG (allowed mime type). Unique filename.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64'
    );
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    storagePath = `${studentAId}/${fileTaskId}/${unique}`;
    const { error } = await studentA.client.storage.from(BUCKET)
      .upload(storagePath, png, { contentType: 'image/png', upsert: false });
    if (error) fail('Phase 2', 'Student A upload file', errText(error));
    else pass('Phase 2', 'Student A upload file', 'ok');
    const convOk = storagePath.split('/')[0] === studentAId && storagePath.split('/')[1] === fileTaskId;
    if (convOk) pass('Phase 2', 'storage path = {student}/{task}/{file}', storagePath.replace(studentAId, '<studentA>').replace(fileTaskId, '<task>'));
    else fail('Phase 2', 'storage path convention', storagePath);

    // Save storage_path on a submission for the file task.
    const { data: prior } = await studentA.client.from('coaching_submissions').select('*')
      .eq('task_id', fileTaskId).eq('student_id', studentAId).maybeSingle();
    if (prior) {
      const { error } = await studentA.client.rpc('update_own_coaching_submission', {
        p_submission_id: prior.id, p_text_response: null, p_storage_path: storagePath,
        p_duration_seconds: null, p_submit: true,
      });
      if (error) fail('Phase 2', 'storage_path saved', errText(error));
      else pass('Phase 2', 'storage_path saved', 'ok');
    } else {
      const { error } = await studentA.client.from('coaching_submissions').insert({
        task_id: fileTaskId, student_id: studentAId, text_response: null,
        storage_path: storagePath, duration_seconds: null, status: 'submitted', submitted_at: new Date().toISOString(),
      });
      if (error) fail('Phase 2', 'storage_path saved', errText(error));
      else pass('Phase 2', 'storage_path saved', 'ok');
    }
    const { data: stored } = await studentA.client.from('coaching_submissions').select('storage_path')
      .eq('task_id', fileTaskId).eq('student_id', studentAId).maybeSingle();
    if (stored?.storage_path === storagePath) pass('Phase 2', 'stored path is relative (no public URL)', 'relative');
    else fail('Phase 2', 'stored path is relative (no public URL)', JSON.stringify(stored?.storage_path));
    if (!String(stored?.storage_path ?? '').startsWith('http')) pass('Phase 2', 'no public URL stored', 'ok');
    else fail('Phase 2', 'no public URL stored', 'public URL found');

    // Private bucket: public URL must fail.
    const pubUrl = `${URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    const pubRes = await fetch(pubUrl).catch(() => ({ status: 0 }));
    if (pubRes.status >= 400) pass('Phase 2', 'public URL inaccessible (private bucket)', `HTTP ${pubRes.status}`);
    else fail('Phase 2', 'public URL inaccessible (private bucket)', `HTTP ${pubRes.status}`);

    // Access checks.
    const sA = await studentA.client.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (sA.error) fail('Phase 2', 'Student A access own file', errText(sA.error));
    else pass('Phase 2', 'Student A access own file', 'signed URL ok');

    const cA = await coachA.client.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (cA.error) fail('Phase 2', 'Coach A access assigned file', errText(cA.error));
    else pass('Phase 2', 'Coach A access assigned file', 'signed URL ok');

    const sB = await studentB.client.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (sB.error) pass('Phase 2', 'Student B denied file', errText(sB.error));
    else fail('Phase 2', 'Student B denied file', 'signed URL issued!');

    const cB = await coachB.client.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (cB.error) pass('Phase 2', 'Coach B denied file', errText(cB.error));
    else fail('Phase 2', 'Coach B denied file', 'signed URL issued!');
  }

  // ---------------- PHASE 3: NEGATIVE RLS ----------------
  {
    const { data } = await studentB.client.from('coaching_enrollments').select('id').eq('id', enrollmentId);
    if ((data ?? []).length === 0) pass('Phase 3 StudentB', 'cannot see Student A enrollment', '0 rows');
    else fail('Phase 3 StudentB', 'cannot see Student A enrollment', JSON.stringify(data));
  }
  {
    const { data } = await studentB.client.from('coaching_weekly_plans').select('id').eq('enrollment_id', enrollmentId);
    if ((data ?? []).length === 0) pass('Phase 3 StudentB', 'cannot see Student A weekly plan', '0 rows');
    else fail('Phase 3 StudentB', 'cannot see Student A weekly plan', JSON.stringify(data));
  }
  {
    const { data } = await studentB.client.from('coaching_tasks').select('id').eq('id', textTaskId);
    if ((data ?? []).length === 0) pass('Phase 3 StudentB', 'cannot see Student A tasks', '0 rows');
    else fail('Phase 3 StudentB', 'cannot see Student A tasks', JSON.stringify(data));
  }
  {
    const { data } = await studentB.client.from('coaching_submissions').select('id').eq('id', submissionId);
    if ((data ?? []).length === 0) pass('Phase 3 StudentB', 'cannot see Student A submission', '0 rows');
    else fail('Phase 3 StudentB', 'cannot see Student A submission', JSON.stringify(data));
  }

  {
    const { data } = await coachB.client.from('coaching_enrollments').select('id').eq('coach_id', coachBId);
    if (!(data ?? []).some((e) => e.id === enrollmentId)) pass('Phase 3 CoachB', 'does not see Student A on dashboard', 'not visible');
    else fail('Phase 3 CoachB', 'does not see Student A on dashboard', 'visible');
  }
  {
    const { data } = await coachB.client.from('coaching_enrollments').select('id').eq('id', enrollmentId);
    if ((data ?? []).length === 0) pass('Phase 3 CoachB', 'cannot open Student A workspace (direct id)', '0 rows');
    else fail('Phase 3 CoachB', 'cannot open Student A workspace (direct id)', JSON.stringify(data));
  }
  {
    const { data } = await coachB.client.from('coaching_submissions').select('id').eq('id', submissionId);
    if ((data ?? []).length === 0) pass('Phase 3 CoachB', 'cannot read Student A submission', '0 rows');
    else fail('Phase 3 CoachB', 'cannot read Student A submission', JSON.stringify(data));
  }
  {
    const { data, error } = await coachB.client.rpc('review_coaching_submission', {
      p_submission_id: submissionId, p_feedback_text: 'HACK', p_feedback_score: null,
      p_feedback_data: {}, p_request_revision: false,
    });
    if (error || !row(data)) pass('Phase 3 CoachB', 'cannot review Student A submission', errText(error) || 'no row');
    else fail('Phase 3 CoachB', 'cannot review Student A submission', 'reviewer succeeded!');
  }

  // ---------------- PHASE 4: FIELD OWNERSHIP ----------------
  // Use the file-task submission (status=submitted) for "safe RPC still works".
  let fileSubId = null;
  if (fileTaskId) {
    const { data } = await studentA.client.from('coaching_submissions').select('id,status')
      .eq('task_id', fileTaskId).eq('student_id', studentAId).maybeSingle();
    fileSubId = data?.id ?? null;
  }

  if (submissionId) {
    const { data, error } = await studentA.client.from('coaching_submissions')
      .update({ feedback_text: 'HACK by student', reviewed_by: studentAId })
      .eq('id', submissionId).select('id');
    if (error || (data ?? []).length === 0) pass('Phase 4 StudentA', 'direct UPDATE feedback/reviewer denied', errText(error) || '0 rows affected');
    else fail('Phase 4 StudentA', 'direct UPDATE feedback/reviewer denied', 'UPDATE succeeded!');
  }
  if (submissionId) {
    const { data, error } = await studentA.client.from('coaching_submissions')
      .update({ student_id: studentBId, task_id: fileTaskId }).eq('id', submissionId).select('id');
    if (error || (data ?? []).length === 0) pass('Phase 4 StudentA', 'direct UPDATE identity fields denied', errText(error) || '0 rows affected');
    else fail('Phase 4 StudentA', 'direct UPDATE identity fields denied', 'UPDATE succeeded!');
  }
  if (fileSubId) {
    const { data, error } = await studentA.client.rpc('update_own_coaching_submission', {
      p_submission_id: fileSubId, p_text_response: 'safe rpc ok', p_storage_path: storagePath,
      p_duration_seconds: null, p_submit: true,
    });
    if (!error && row(data)) pass('Phase 4 StudentA', 'legitimate safe RPC still works', 'ok');
    else fail('Phase 4 StudentA', 'legitimate safe RPC still works', errText(error));
  }

  if (submissionId) {
    const { data, error } = await coachA.client.from('coaching_submissions')
      .update({ text_response: 'HACK by coach' }).eq('id', submissionId).select('id');
    if (error || (data ?? []).length === 0) pass('Phase 4 CoachA', 'direct UPDATE text_response denied', errText(error) || '0 rows affected');
    else fail('Phase 4 CoachA', 'direct UPDATE text_response denied', 'UPDATE succeeded!');
  }
  if (fileSubId) {
    const { data, error } = await coachA.client.rpc('review_coaching_submission', {
      p_submission_id: fileSubId, p_feedback_text: 'Reviewed (field-ownership test).',
      p_feedback_score: null, p_feedback_data: {}, p_request_revision: false,
    });
    if (!error && row(data)) pass('Phase 4 CoachA', 'legitimate review RPC works', `status=${row(data).status}`);
    else fail('Phase 4 CoachA', 'legitimate review RPC works', errText(error));
  }

  // ---------------- PHASE 5: PROFILE VISIBILITY (MIGRATION 019) ----------------
  {
    const { data } = await coachA.client.from('profiles').select('id,full_name').eq('id', studentAId);
    if ((data ?? []).length === 1 && data[0].full_name === 'Student One') pass('Phase 5', 'Coach A -> Student A profile', data[0].full_name);
    else fail('Phase 5', 'Coach A -> Student A profile', JSON.stringify(data));
  }
  {
    const { data } = await coachA.client.from('profiles').select('id').eq('id', studentBId);
    if ((data ?? []).length === 0) pass('Phase 5', 'Coach A -/-> Student B profile', '0 rows');
    else fail('Phase 5', 'Coach A -/-> Student B profile', JSON.stringify(data));
  }
  {
    const { data } = await studentA.client.from('profiles').select('id,full_name').eq('id', coachAId);
    if ((data ?? []).length === 1 && data[0].full_name === 'Teacher One') pass('Phase 5', 'Student A -> Coach A profile', data[0].full_name);
    else fail('Phase 5', 'Student A -> Coach A profile', JSON.stringify(data));
  }
  {
    const { data } = await studentA.client.from('profiles').select('id').eq('id', coachBId);
    if ((data ?? []).length === 0) pass('Phase 5', 'Student A -/-> Coach B profile', '0 rows');
    else fail('Phase 5', 'Student A -/-> Coach B profile', JSON.stringify(data));
  }
  {
    const a = await coachA.client.from('profiles').select('id').eq('id', coachAId);
    const s = await studentA.client.from('profiles').select('id').eq('id', studentAId);
    if ((a.data ?? []).length === 1 && (s.data ?? []).length === 1) pass('Phase 5', 'own-profile access still works', 'ok');
    else fail('Phase 5', 'own-profile access still works', `coach=${a.data?.length} student=${s.data?.length}`);
  }

  // ---------------- OUTPUT ----------------
  const sections = [...new Set(results.map((r) => r.section))];
  for (const sec of sections) {
    console.log(`\n## ${sec}`);
    for (const r of results.filter((x) => x.section === sec)) {
      console.log(`  [${r.status}] ${r.name}${r.evidence ? ` — ${r.evidence}` : ''}`);
    }
  }
  const total = results.filter((r) => r.status !== 'INFO').length;
  console.log(`\n===== ${total - fails}/${total} checks passed, ${fails} failed =====`);
  console.log('IDS ' + JSON.stringify({ enrollmentId, planId, textTaskId, fileTaskId, submissionId, fileSubId, storagePath }));
}

main().catch((e) => { console.error('[FATAL]', e?.message ?? e); process.exit(1); });
