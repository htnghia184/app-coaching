# Codebase map — app-coaching

**Evidence:** GitHub files read on 2026-11-25, repository `htnghia184/app-coaching`, latest commit returned by connector `4def068297c2fcb73ed99c10c50432dbdff8ec0c`. The GitHub recursive tree was enumerated completely (59 entries, `truncated=false`); source behavior review remains targeted. Recheck HEAD and paths before modifying code.

| Concern | Primary files | Notes |
| --- | --- | --- |
| Route composition | `src/App.tsx`, `src/main.tsx` | Login, student, coach, admin, role-protected routes |
| Session and authorization UI | `src/auth/AuthProvider.tsx`, `src/components/RequireRole.tsx`, `src/components/LoginPage.tsx` | Client role checks do not replace database RLS |
| Supabase access | `src/lib/supabaseClient.ts`, `src/lib/coachingService.ts` | Centralized authenticated service layer; service file ~565 lines |
| Domain contract | `src/lib/types.ts` | Types reflect migration 018 contract; ~231 lines |
| Admin enrollment | `src/pages/AdminEnrollment.tsx` | Creates enrollments, coach assignment; current UI has multi-track suggestions |
| Coach list / attention | `src/pages/CoachDashboard.tsx` | Assigned learners, status/attention |
| Coach planning and feedback | `src/pages/CoachWorkspace.tsx` | Roadmap, weekly plans, tasks, review; ~1248 lines |
| Student overview | `src/pages/StudentDashboard.tsx` | Roadmap, progress, tasks; ~636 lines |
| Student task and submission | `src/pages/StudentTaskDetail.tsx` | Text/audio/file/checkoff, revisions; ~470 lines |
| Revision presentation | `src/components/RevisionHistory.tsx` | Review history UI |
| PWA | `vite.config.ts`, app notices/offline components | App-shell caching only; no private API caching intended |
| Build | `package.json`, `tsconfig.json` | `npm run typecheck`, `npm run build` |
| E2E/security harnesses | `scripts/e2e-smoke.mjs`, `scripts/e2e-slice-011.mjs`, `scripts/e2e-slice-02.mjs` | Potentially data-writing; require explicit test-environment approval |

## Feature dependency paths

- **Enrollment:** `App.tsx` → `AdminEnrollment.tsx` → `coachingService.ts` → shared Supabase tables/RLS.
- **Roadmap and weekly plan:** `CoachWorkspace.tsx` ↔ `StudentDashboard.tsx` → `coachingService.ts` → shared Supabase.
- **Submission and revision:** `StudentTaskDetail.tsx` ↔ `CoachWorkspace.tsx` / `RevisionHistory.tsx` → `coachingService.ts` → RPCs and revision history; private attachment storage.
- **Login and roles:** `LoginPage.tsx` → `AuthProvider.tsx` / `RequireRole.tsx` → session/profile; backend RLS remains authoritative.

## IELTS module proposal on `codex/ielts-module-engine`

Implementation commit `ee5199d` adds `src/modules/ree.ts` (source-traceable public manifest), `InteractionRegistry.tsx`, `AudioPrompt.tsx`, `moduleService.ts`, `CoachModuleReview.tsx` and `src/pages/ModulePlayer.tsx`. Student entry is `App.tsx` route `/student/modules/:taskId`, linked from `StudentDashboard.tsx` when `task.module_id` is present. Coach module assignment/review is in `CoachWorkspace.tsx`. Proposed, unapplied schema/RPC changes live in `docs/proposed/ielts_module_engine.sql`; content mapping and release gates are in `docs/IELTS_MODULE_ENGINE_HANDOFF.md`. Existing 1:1 task routes and service methods remain in place.

Follow-up commit `bbfe0d1` adds `src/modules/history.ts` and task-level evidence loading so a Verify retry can view prior Discover/Apply recordings while requiring a new Verify recording from the current attempt.

Review response commit `b3b70f4dc7ef4badab0802f2ebc54d1025ef52bc` adds `src/modules/activityValidation.ts`, `reviewEvidence.ts`, `recordingSave.ts`, and `src/lib/coachingStoragePath.ts`. `ModulePlayer.tsx` now reads only the current attempt plus its declared inherited source; `CoachModuleReview.tsx` labels those evidence sources and requires audio-duration confirmation. `docs/proposed/ielts_module_engine.sql` remains unapplied and now pins private keys to content version, validates REE payloads and stage order, and requires attempt-scoped audio paths.

## Documentation boundary
Local project documentation supplied by product owner (master context, decision log, backlog, pilot, Trae task, dated audits) is **not automatically synced to GitHub**. The existing technical source documents are present under `docs/`: `00_READ_ME_FIRST.md`, `ARCHITECTURE_V1.md`, `DATABASE_V1.md`, `VERTICAL_SLICE_01.md`, and `PRODUCT_SPEC_V1.md — E-Master Personal Coaching.md`. Follow `docs/00_READ_ME_FIRST.md` for precedence and task-based reading. The root-path 404s in the initial inspection were path errors, not missing documentation.

## Known audit limits
Full Git tree enumeration completed (59 entries). No local install/build, browser E2E, production database inspection, or Vercel verification was performed for this map. Large-file size is a maintenance signal, **not** proof of a bug or mandate to refactor.
