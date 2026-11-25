# Implementation status — evidence register

**Snapshot date:** 2026-11-25. **Inventory:** 59 recursive tree entries, complete. Historical docs were found under `docs/`, correcting an earlier root-path lookup error. **GitHub latest commit returned:** `4def068297c2fcb73ed99c10c50432dbdff8ec0c` (`main`). This register is a source inspection, **not** an authenticated deployment audit. Refresh against HEAD when implementation changes.

| Area | Source inspection | Runtime / live verification |
| --- | --- | --- |
| Login and role-based routing | PRESENT in `App.tsx`, `AuthProvider.tsx`, `RequireRole.tsx` | NOT VERIFIED |
| Admin enrollment | PRESENT in `AdminEnrollment.tsx` and service | NOT VERIFIED |
| Coach roadmap, weekly plan, tasks | PRESENT in `CoachWorkspace.tsx` and service | NOT VERIFIED |
| Student dashboard and task submission | PRESENT in student pages and service | NOT VERIFIED |
| Coach review, revisions/history | PRESENT in service and `RevisionHistory.tsx` | NOT VERIFIED |
| Private attachment/signed URL implementation | Documented in README and service; live policy unknown | NOT VERIFIED |
| PWA offline shell / update behavior | PRESENT in `vite.config.ts` and related UI | NOT VERIFIED on devices |
| E2E smoke/regression harness | Scripts PRESENT under `scripts/` | NOT EXECUTED |
| Migration 018/019/020 and live RLS | `docs/DATABASE_V1.md` and `docs/00_READ_ME_FIRST.md` document migration 018 v2.2 and historical 8/8 verification; migrations 019/020 and current live state not verified | NOT VERIFIED |
| IELTS ModulePlayer | NOT CONFIRMED in targeted source review | NOT VERIFIED |
| Versioned module content + validation | NOT CONFIRMED | NOT VERIFIED |
| Six IELTS interaction renderers | NOT CONFIRMED | NOT VERIFIED |
| Separate module completion/mastery/attempts | NOT CONFIRMED | NOT VERIFIED |
| 12 IELTS micro-modules populated | NO EVIDENCE in inspected source | NOT VERIFIED |
| 10 paying IELTS learners | Business gate recorded in supplied local documents | NO ACTUALS PROVIDED |

## Product scope versus engineering evidence
- Product owner confirmed **IELTS-only** for current pilot in 2026-11-17 handoff. Existing `AdminEnrollment.tsx` includes TOEIC/VSTEP/General English suggestions: **UI scope mismatch**, not authorization to change schema.
- 12 IELTS modules by 2026-11-23 was a **target**, not proof of delivery; deadline is past as of this snapshot.
- The business validation gate is **10 paying learners**, separate from the content milestone.
- The module design specifies six interaction types and the Discover → Learn → Practice → Apply → Reflect → Verify sequence. Do not equate coaching task types with interactive question types.

## Prioritized verification plan
1. Obtain current product-owner source documents and compare decisions against this register.
2. Repository tree inventory COMPLETE: 59 entries at base SHA, `truncated=false`; five historical specs found under `docs/`. Review spec-to-code drift before changes.
3. In a controlled environment, run `npm run typecheck` and `npm run build`; record output and SHA.
4. Inspect actual Supabase migrations, RPCs, RLS and private bucket policies **read-only**; never rerun migration 018 or change production without approval.
5. Run authorized role-based E2E and mobile/browser QA with disposable test accounts; report PASS/FAIL/NOT EXECUTED per case.
6. Only then select a representative IELTS module and implement/QA the full assign → learn → practice → submit → coach feedback → revise → mastery loop.

## Update protocol
Every status change must include date, SHA, environment, exact test/evidence, actor and unresolved risk. Source-present is not test-passed; test-passed is not deployed; deployed is not production-verified.

## Connected-service verification — 2026-11-25 (read-only)

- **Vercel:** project `app-coaching` exists (Vite, Node 24). Production deployment `dpl_DNKXKXQuEyuc6Stm4xUZgayZ47MG` is `READY`, `target=production`, branch `main`, commit `4def068297c2fcb73ed99c10c50432dbdff8ec0c`. Project lists `learn.e-master.vn` and `www.learn.e-master.vn` as attached domains. `READY` confirms deployment state, not authenticated feature behavior.
- **Draft PR preview:** deployment `dpl_EQx1ZHiv3jnmLrokcvp9d8PiESqD` is `READY` on `docs/ai-context-audit-20261125`, commit `5a066ac7f03d7ee65b29090053098710e4c25599`, `target=null` (preview). Build logs show `npm run build` and successful build/deployment, with npm install-script and chunk-size warnings. This is **not** a production deployment.
- **Supabase connector scope:** only project `app-thu-mua` was returned by connected project listing; the shared E-Master assessment/coaching Supabase project was **not available through this connection**. No schema, RLS, RPC, storage or migration inspection was performed on the E-Master database. Do **not** infer coaching DB status from the shrimp app project.
- **Not performed:** login, learner/coach role E2E, RLS penetration checks, mobile UX, authenticated production data inspection, or live HTTP domain verification.

**Next dependency:** connect/grant access to the actual E-Master shared Supabase project (the one backing `test.e-master.vn`) before conducting the planned read-only DB/RLS audit. Keep this PR draft until reviewed.

## Live Supabase security audit — 2026-11-25 (read-only; urgent)

**Scope:** E-Master organization, project `ypsggndvjzquionaapjs`. No writes or exploit tests performed.

- All 26 `public` tables report RLS enabled; coaching tables and `learning_modules` are present. `list_migrations` returned an empty list; this does **not** establish that migration 018/019/020 SQL was never applied.
- **CRITICAL potential privilege escalation:** `profiles` has `UPDATE` policy for `auth.uid() = id` without restricting `role`, while `authenticated` has column-level UPDATE privilege on `profiles.role`. `get_user_role()` reads `profiles.role`. Restrict role updates and ensure legitimate admin role management remains available.
- **CRITICAL potential signup role injection:** `public.handle_new_user()` inserts `COALESCE((new.raw_user_meta_data->>'role')::user_role,'student')` into `profiles.role`. User metadata is not a trusted authorization source. Force a safe default role on signup and move privileged role assignment to a trusted admin-only path.
- Security Advisor reports 10 `SECURITY DEFINER` functions executable by `anon` and `authenticated`; functions include `admin_create_user`, `admin_delete_user`, `get_user_role`, and coaching RPCs. Inspection found admin and coaching RPCs do have internal role/ownership checks, so public EXECUTE **alone** is not proof of unauthorized operations. Still reduce exposed EXECUTE grants based on intended callers, especially trigger-only functions.
- `coaching-submissions` Storage bucket exists, `public=false`, 50 MiB file size limit. Storage policies constrain student paths by UID and task enrollment; coach reads by assigned enrollment. `exam-audio` is a separate public bucket with anonymous upload/read, relevant to test portal and worth a separate abuse/privacy review.
- Leaked-password protection disabled per Supabase Security Advisor.
- No authenticated E2E, malicious-user simulation, or production changes. Before fixing, review affected code/DB dependencies and test in a safe environment; apply migration with rollback plan and verify using student/admin/anonymous role scenarios.

**Priority:** Protect `profiles.role` and remove role assignment from user-editable signup metadata before onboarding more learners. Do not merge a docs PR as a substitute for implementing these security fixes.
