#!/usr/bin/env node
/**
 * E-Master Coaching — LOCAL test-user cleanup.
 *
 * ADMIN TOOLING ONLY. Never import or run this from browser/frontend code.
 * Deletes ONLY the five exact test emails listed below via the Admin Auth API.
 * Never touches any non-test account. Never runs automatically: it requires
 * an explicit --confirm flag, otherwise it exits without doing anything.
 *
 * Usage (Node >= 20.6 for --env-file):
 *   node --env-file=scripts/.env.test scripts/cleanup-test-users.mjs --confirm
 *
 * Optional flag:
 *   --purge-test-coaching
 *     Also removes coaching rows that belong to the test identities, which are
 *     needed because coaching_enrollments / coaching_sessions / coaching_submissions
 *     reference public.profiles(id) ON DELETE RESTRICT. Only rows whose relevant
 *     participant ids are all within the test set are removed; anything involving
 *     a non-test account is left untouched and reported as a blocker.
 */
import { createClient } from '@supabase/supabase-js';

const TEST_EMAILS = [
  'admin-test@e-master.vn',
  'teacher2@e-master.vn',
  'teacher3@e-master.vn',
  'student2@e-master.vn',
  'student3@e-master.vn',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`[FATAL] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value.trim();
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Rows that block hard-deleting a profile (FK ON DELETE RESTRICT on profiles). */
async function countBlockers(admin, ids) {
  const [enroll, sessions, submissions] = await Promise.all([
    admin.from('coaching_enrollments').select('id, student_id, coach_id').or(`student_id.in.(${ids.join(',')}),coach_id.in.(${ids.join(',')})`),
    admin.from('coaching_sessions').select('id, coach_id').in('coach_id', ids),
    admin.from('coaching_submissions').select('id, student_id').in('student_id', ids),
  ]);
  for (const res of [enroll, sessions, submissions]) {
    if (res.error) throw res.error;
  }
  return {
    enrollments: enroll.data,
    sessions: sessions.data,
    submissions: submissions.data,
  };
}

function blockerCount(b) {
  return b.enrollments.length + b.sessions.length + b.submissions.length;
}

/** Remove coaching rows that belong entirely to the test identities. */
async function purgeTestOwnedCoaching(admin, ids) {
  const testIdSet = new Set(ids);

  const { data: enrollments, error: readErr } = await admin
    .from('coaching_enrollments')
    .select('id, student_id, coach_id');
  if (readErr) throw readErr;

  const fullyTestOwned = enrollments
    .filter((e) => testIdSet.has(e.student_id) && testIdSet.has(e.coach_id))
    .map((e) => e.id);

  if (fullyTestOwned.length > 0) {
    // Deleting the enrollment cascades its coaching_sessions rows.
    const { error } = await admin.from('coaching_enrollments').delete().in('id', fullyTestOwned);
    if (error) throw error;
  }

  const { error: subErr } = await admin.from('coaching_submissions').delete().in('student_id', ids);
  if (subErr) throw subErr;

  console.log(`[INFO] Purged ${fullyTestOwned.length} test-owned enrollment(s) and test-owned submissions.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.error('[ABORT] Cleanup is destructive and requires an explicit --confirm flag.');
    console.error('        node --env-file=scripts/.env.test scripts/cleanup-test-users.mjs --confirm');
    process.exit(2);
  }
  const purge = args.includes('--purge-test-coaching');

  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve only the five exact test accounts. Anything not found is skipped.
  const resolved = [];
  for (const email of TEST_EMAILS) {
    const user = await findUserByEmail(admin, email);
    if (user) resolved.push({ email, id: user.id });
  }

  if (resolved.length === 0) {
    console.log('[INFO] None of the test accounts exist. Nothing to do.');
    return;
  }

  const ids = resolved.map((r) => r.id);

  let blockers = await countBlockers(admin, ids);
  if (blockerCount(blockers) > 0 && purge) {
    await purgeTestOwnedCoaching(admin, ids);
    blockers = await countBlockers(admin, ids);
  }

  const rows = [];
  let failures = 0;

  for (const { email, id } of resolved) {
    const blockedHere = blockerCount({
      enrollments: blockers.enrollments.filter((e) => e.student_id === id || e.coach_id === id),
      sessions: blockers.sessions.filter((s) => s.coach_id === id),
      submissions: blockers.submissions.filter((s) => s.student_id === id),
    });

    if (blockedHere > 0) {
      rows.push({ email, auth_user: 'kept', profile: 'kept', result: `blocked (${blockedHere} related row(s))` });
      failures++;
      continue;
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(id);
    if (delErr) {
      rows.push({ email, auth_user: 'kept', profile: 'kept', result: `error: ${delErr.message}` });
      failures++;
      continue;
    }

    // public.profiles.id REFERENCES auth.users(id) ON DELETE CASCADE, so the
    // profile row is removed automatically. Verify and clean up if a stray row remains.
    const { data: leftover, error: readErr } = await admin.from('profiles').select('id').eq('id', id);
    if (readErr) throw readErr;

    let profileStatus = 'cascaded';
    if (leftover && leftover.length > 0) {
      const { error: profDelErr } = await admin.from('profiles').delete().eq('id', id);
      if (profDelErr) throw profDelErr;
      profileStatus = 'removed';
    }

    rows.push({ email, auth_user: 'deleted', profile: profileStatus, result: 'ok' });
  }

  console.log('\nemail | auth_user | profile | result');
  console.log('------|-----------|---------|-------');
  for (const r of rows) {
    console.log(`${r.email} | ${r.auth_user} | ${r.profile} | ${r.result}`);
  }

  if (failures > 0) {
    console.error(`\n[ATTENTION] ${failures} account(s) could not be deleted (see result column).`);
    process.exit(1);
  }
  console.log('\n[DONE] Test accounts removed.');
}

main().catch((err) => {
  console.error(`[FATAL] ${err?.message ?? err}`);
  process.exit(1);
});
