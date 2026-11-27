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

## Release hardening and private draft import

- Starting from commit `79d49b8`, qualified correlated RLS references were added to the base proposal and the separate review-only hardening SQL was applied **only to Supabase Local**. Local tests cover cross-module and cross-version isolation; typed response and required activity checks; Verify duration rules; immutable recording rows and referenced Storage objects; transactional Verify submission with concurrent same-key requests, changed-payload rejection, failed-request rollback and retry; and targeted M02 revision that inherits accepted recordings while preserving both review rows. The UI uses the atomic Verify RPC and labels accepted recordings on targeted retry.
- `D:/coaching-private-draft/README.md` and all four private manifests and assessment sidecars were read. All four manifests passed `parsePublicModule`. The import script stored them as **unpublished** admin-only drafts in Supabase Local, with assessment sidecars in `coaching_private`. No private package file, answer key, media ID or generated media environment file is tracked in Git.
- The authenticated local admin preview at `/local-private-drafts` renders actual candidate learner content from the local draft table. Three owner-mapped videos resolved through the private local Edge Function config. A dependency-free headless Chrome regression checked four admin drafts, all three video embeds, Coach and Student workspaces, and student denial from the draft preview.
- The draft package is a manually structured conversion. Its README records summarized or omitted lesson detail, M02 reflection flattened from 24 cells, M03 composite response gaps, unresolved audio, and outstanding source parity decisions. Importing the package preserves its supplied manifest and assessment JSON; it does **not** restore missing Word content or authorize publication.

## Remaining release blockers

1. The SQL remains review-only. Independent security review, migration ordering/backfill, and a safe rollout plan are required before any shared-backend application. The server checks response types and required activities, but source-specific composite interactions and actual media duration measurement need completion before release.
2. Nhựt must reconcile the private conversion with the authoritative Word packages, restore omitted material and structures, resolve audio gaps, visually check the three videos, and approve academic content and publication. Draft import is not source parity.
3. Automated browser coverage currently verifies authentication, role boundaries and private draft videos; the full assign → revise → reassess workflow was manually observed previously and is not yet an automated browser regression. Production-like deployment remains unverified. Local URLs work only while local services run.

The four-module specification remains the subsystem contract. Module completion does not imply LO mastery.
