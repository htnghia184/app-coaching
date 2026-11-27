# Integrated Coaching Pilot verification — 2026-11-27

Branch `codex/integrated-coaching-pilot-20261127` remains a draft integration of Coaching Core and the generic module engine. All database writes described here used the verified isolated Supabase Local stack (`supabase_db_codex-coaching`, PostgreSQL 17.12, ports 54321/54322) and disposable synthetic users. Neither SQL proposal was run in production.

## Implemented and observed

- The development-only `/local-pilot` Coach and Student workspace uses authenticated Supabase Local enrollment, weekly plan, tasks, submissions, revisions, LO evidence and assessment RPCs, generic module assignment and progress RPCs, private Storage, and the media resolver. It refuses non-local backends. Existing production-facing flows remain in place.
- The review-only `docs/proposed/generic_module_persistence_review_only.sql` pins assignments and evidence to immutable generic module IDs and content versions; persists attempts, stage progress, responses, recordings, Verify submissions and coach reviews; and applies ownership validation, RLS and least-privilege RPCs. It stays separate from REE-specific attempts and from LO mastery assessment.
- The four Speaking module previews use structural synthetic fixtures. M01 Verify requires a fresh recording and rubric sum at least 6/8 with no zero criterion; M02 requires five of six accepted items with no repeated question. Stage completion and module Verify remain separate from LO assessment. Direct task and live-session evidence remain independent of modules.
- The media resolver was exercised with authenticated assigned student, assigned coach and admin access. Unrelated student and coach, anonymous caller, wrong version, wrong asset and wrong browser origin were denied. Existing assessment application anonymous reads/grants were preserved, while coaching RPCs denied anonymous use.
- An authenticated browser session on `http://127.0.0.1:5174/local-pilot` demonstrated assignment, learning, private synthetic WebM upload, evidence submission, coach review, revision, reassessment and next-task prescription. A later strict Verify browser submission persisted an `awaiting_review` attempt with five prerequisite stages and one private recording. Browser observations were checked against Supabase Local rows; HTTP 200 alone was not treated as proof.

## Exact checks

- `npm run typecheck`: PASS.
- `npm run build`: PASS; Vite emitted a non-failing bundle-size warning.
- `node --test tests/*.test.mjs` with Supabase Local URL, anon key and JWT secret from `supabase status -o env`, plus the locally served media Edge Function: **30 passed, 0 failed**. This includes the local coaching and media integration test and `tests/module-import-local.test.mjs` **36/36** authorization/private-draft checks. The expected immutable-version rejection prints a PostgreSQL error line during the passing test.

## Remaining release blockers

1. The SQL is review-only. Schema/RLS/RPC and Storage ownership rules need independent security review, including the ability to delete a referenced recording and atomicity of coaching submission plus generic Verify submission. Do not apply it to the shared backend without approval and a release migration plan.
2. Four module fixtures contain structural placeholders. Authentic SharePoint teaching content and media require authorized private import, source parity review and academic sign-off. No private teaching asset was committed.
3. The browser flow was manually observed in Supabase Local; automated browser regression coverage and production-like deployment verification remain outstanding. The local URL works only while the local services run; it is not a hosted preview.

The four-module specification remains the subsystem contract. Module completion does not imply LO mastery.
