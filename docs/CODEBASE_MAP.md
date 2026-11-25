# Codebase map — app-coaching

**Evidence:** GitHub files read on 2026-11-25, repository `htnghia184/app-coaching`, latest commit returned by connector `4def068297c2fcb73ed99c10c50432dbdff8ec0c`. This is a **targeted source map**, not an exhaustive recursive inventory. Recheck HEAD and paths before modifying code.

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

## Documentation boundary
Local project documentation supplied by product owner (master context, decision log, backlog, pilot, Trae task, dated audits) is **not automatically synced to GitHub**. Historical references to `00_READ_ME_FIRST.md`, `ARCHITECTURE_V1.md`, `DATABASE_V1.md`, and `VERTICAL_SLICE_01.md` were not found at repository root on `main` during this check. Search their actual locations or request source files before relying on them. Do not recreate old specs from memory.

## Known audit limits
No full Git tree enumeration, local install/build, browser E2E, production database inspection, or Vercel verification was performed for this map. Large-file size is a maintenance signal, **not** proof of a bug or mandate to refactor.
