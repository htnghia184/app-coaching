# Implementation status — evidence register

**Snapshot date:** 2026-11-25. **GitHub latest commit returned:** `4def068297c2fcb73ed99c10c50432dbdff8ec0c` (`main`). This register is a source inspection, **not** an authenticated deployment audit. Refresh against HEAD when implementation changes.

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
| Migration 018/019/020 and live RLS | Historical docs/contract references only; migrations not verified in this repo | NOT VERIFIED |
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
2. Inventory all tracked repository files and confirm whether older specs exist under different paths.
3. In a controlled environment, run `npm run typecheck` and `npm run build`; record output and SHA.
4. Inspect actual Supabase migrations, RPCs, RLS and private bucket policies **read-only**; never rerun migration 018 or change production without approval.
5. Run authorized role-based E2E and mobile/browser QA with disposable test accounts; report PASS/FAIL/NOT EXECUTED per case.
6. Only then select a representative IELTS module and implement/QA the full assign → learn → practice → submit → coach feedback → revise → mastery loop.

## Update protocol
Every status change must include date, SHA, environment, exact test/evidence, actor and unresolved risk. Source-present is not test-passed; test-passed is not deployed; deployed is not production-verified.
