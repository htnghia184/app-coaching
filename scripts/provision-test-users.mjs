#!/usr/bin/env node
/**
 * E-Master Coaching — one-time LOCAL test-user provisioning.
 *
 * ADMIN TOOLING ONLY. Never import or run this from browser/frontend code:
 * it uses the Supabase service-role key, which must never reach the client.
 *
 * Usage (Node >= 20.6 for --env-file):
 *   node --env-file=scripts/.env.test scripts/provision-test-users.mjs
 *
 * Required server-only env (never use a VITE_ prefix):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEST_USER_PASSWORD
 *
 * Behaviour:
 *   - Creates each test account through the official Admin Auth API
 *     (supabase.auth.admin.createUser). Never INSERTs into auth.users directly.
 *   - Re-runnable: an existing test email is reused, never duplicated.
 *   - Marks accounts email-confirmed so signInWithPassword works immediately.
 *   - Re-syncs public.profiles (id, email, full_name, role) to the expected values.
 *   - Creates NO coaching enrollments.
 */
import { createClient } from '@supabase/supabase-js';

const TEST_USERS = [
  { email: 'admin-test@e-master.vn', role: 'admin', full_name: 'Test Admin' },
  { email: 'teacher2@e-master.vn', role: 'teacher', full_name: 'Teacher One' },
  { email: 'teacher3@e-master.vn', role: 'teacher', full_name: 'Teacher Two' },
  { email: 'student2@e-master.vn', role: 'student', full_name: 'Student One' },
  { email: 'student3@e-master.vn', role: 'student', full_name: 'Student Two' },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`[FATAL] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value.trim();
}

/** Look up an auth user by exact email, paging through the Admin API. */
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

async function main() {
  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const TEST_USER_PASSWORD = requireEnv('TEST_USER_PASSWORD');

  if (TEST_USER_PASSWORD.length < 6) {
    console.error('[FATAL] TEST_USER_PASSWORD must be at least 6 characters (GoTrue minimum).');
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = [];
  let failures = 0;

  for (const user of TEST_USERS) {
    let authStatus = '';
    let userId = null;

    try {
      const existing = await findUserByEmail(admin, user.email);

      if (existing) {
        // Reuse: re-sync password, confirmation and metadata so the account is
        // deterministic for the smoke test, without creating a duplicate.
        userId = existing.id;
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password: TEST_USER_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: user.full_name },
        });
        if (error) throw error;
        authStatus = 'reused';
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: user.email,
          password: TEST_USER_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: user.full_name },
        });
        if (error) throw error;
        userId = data.user.id;
        authStatus = 'created';
      }

      if (!userId) throw new Error('Admin API returned no user id.');

      // The auth trigger (on_auth_user_created -> handle_new_user) only sets
      // id/email/full_name and leaves role at its default ('student').
      // Upsert the profile row so id/email/full_name/role are all correct.
      const { error: upsertError } = await admin
        .from('profiles')
        .upsert(
          { id: userId, email: user.email, full_name: user.full_name, role: user.role },
          { onConflict: 'id' },
        );
      if (upsertError) throw upsertError;

      const { data: profile, error: readError } = await admin
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .single();
      if (readError) throw readError;

      const ok =
        profile &&
        profile.email === user.email &&
        profile.full_name === user.full_name &&
        profile.role === user.role;

      rows.push({ email: user.email, role: user.role, profile_status: ok ? 'ok' : 'MISMATCH', auth_status: authStatus });
      if (!ok) failures++;
    } catch (err) {
      failures++;
      rows.push({ email: user.email, role: user.role, profile_status: 'ERROR', auth_status: authStatus || 'failed' });
      console.error(`[ERROR] ${user.email}: ${err?.message ?? err}`);
    }
  }

  console.log('\nemail | role | profile_status | auth_status');
  console.log('------|------|----------------|------------');
  for (const r of rows) {
    console.log(`${r.email} | ${r.role} | ${r.profile_status} | ${r.auth_status}`);
  }

  if (failures > 0) {
    console.error(`\n[FAILED] ${failures} account(s) not provisioned correctly.`);
    process.exit(1);
  }
  console.log('\n[DONE] Test accounts provisioned and profiles synced.');
}

main().catch((err) => {
  console.error(`[FATAL] ${err?.message ?? err}`);
  process.exit(1);
});
