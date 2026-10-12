# E-Master Personal Coaching — READ ME FIRST

## Purpose

This file is the execution handoff for a fresh AI coding-agent session opened directly in the new `learn.e-master.vn` folder.

The agent must read this file before doing anything else.

## 1. Current Project State

This project is **not** at the initial ideation/database-design stage anymore.

Already completed:

1. Product concept/specification was defined.
2. Existing `test.e-master.vn` production database was audited.
3. Coaching database architecture was designed.
4. Migration `018_coaching_mvp.sql` was hardened through v2.2.
5. Migration 018 v2.2 FINAL was manually executed against the existing shared Supabase production project.
6. Supabase returned success.
7. Post-migration metadata verification passed 8/8:
   - 8/8 Coaching tables exist;
   - 8/8 have RLS enabled;
   - 5/5 required functions exist;
   - student submission RPC is SECURITY DEFINER;
   - coach review RPC is SECURITY DEFINER;
   - no generic Coach UPDATE policy exists on `coaching_submissions`;
   - `coaching-submissions` bucket is private with 50 MB limit;
   - 6/6 Coaching Storage policies exist.

Therefore:

**DO NOT repeat the old database-design/migration phase.**

The next task is implementation of `VERTICAL_SLICE_01.md`.

## 2. Source-of-Truth Precedence

Read these files in this order:

1. `00_READ_ME_FIRST.md`
2. `PRODUCT_SPEC_V1.md`
3. `ARCHITECTURE_V1.md`
4. `DATABASE_V1.md`
5. `VERTICAL_SLICE_01.md`

If they appear to conflict, use this precedence:

### Product intent
`PRODUCT_SPEC_V1.md`

Controls:
- product philosophy;
- target experience;
- long-term MVP direction;
- UX principles;
- product positioning.

### Current technical truth
`ARCHITECTURE_V1.md` and `DATABASE_V1.md`

These supersede any earlier conceptual database model, migration proposal, or pre-migration technical assumption in `PRODUCT_SPEC_V1.md`.

### Current implementation scope
`VERTICAL_SLICE_01.md`

This supersedes broader MVP screen lists when deciding **what to build now**.

A feature being described in `PRODUCT_SPEC_V1.md` does NOT automatically mean it belongs in Vertical Slice 01.

## 2A. READ ROUTER / CONTEXT LOADING

After this file (the mandatory first read), load ONLY the sources relevant to the
task type. Do not preload the whole docs set.

| Task type | Read | Do NOT auto-read |
|---|---|---|
| Frontend-only | target component/page; `src/lib/types.ts` (domain types/statuses); `src/lib/coachingService.ts` (data access); relevant shared component/style config | PRODUCT_SPEC_V1, DATABASE_V1, migrations, unrelated pages |
| DB / RLS / RPC / Storage | live deployed Supabase state + relevant migration/source | — |
| Product / UX / Scope | `PRODUCT_SPEC_V1.md` + relevant current UI/code | DB docs unless the decision depends on them |
| Testing / Debugging | relevant test harness, affected implementation files, `src/lib/coachingService.ts` | full docs set |
| Architecture / dependency / boundary | `ARCHITECTURE_V1.md` + affected modules | PRODUCT_SPEC unless intent is in question |
| DB design work | `DATABASE_V1.md` (+ live schema overrides summaries) | — |

### Repo map (pointers)

| Area | Location |
|---|---|
| Pages | `src/pages/` (StudentDashboard, StudentTaskDetail, CoachDashboard, CoachWorkspace, AdminEnrollment) |
| Shared UI | `src/components/` (AppLayout, LoginPage, RequireRole, RevisionHistory, StatusBadge, Spinner, AttachmentLink) |
| Domain types / status labels | `src/lib/types.ts` |
| All data access | `src/lib/coachingService.ts` |
| Formatting helpers | `src/lib/format.ts` |
| Supabase client | `src/lib/supabaseClient.ts` |
| Routes | `src/App.tsx` |
| Styling / brand tokens | `tailwind.config.js`, `src/index.css` |
| Test harnesses | `scripts/e2e-smoke.mjs`, `scripts/e2e-slice-011.mjs`, `scripts/e2e-slice-02.mjs` |
| Test fixture env | `scripts/.env.test` (names only — never copy secrets) |
| Source-of-truth docs | `docs/` |

### Hard rules

- Never treat Trae memory or any summary as authoritative for: schema, constraints,
  RLS policies, RPC behavior, storage policies, security claims, current code
  signatures, or secrets. Read the live source.
- DB/RLS/RPC/Storage tasks: always inspect the live deployed Supabase state.
- Live deployed schema/migrations override `DATABASE_V1.md` summaries.
- Expand context only when diagnosis requires it — not "just in case".

## 3. Important Stale Sections in PRODUCT_SPEC_V1

`PRODUCT_SPEC_V1.md` was written before Migration 018 was finalized.

Its product vision remains authoritative, but the following parts describe an earlier project phase and must NOT be re-executed:

- instructions to inspect schema before proposing Coaching tables;
- instructions to generate a proposed Coaching migration;
- instructions to stop for migration approval;
- conceptual entity/table names under "Proposed Data Domain";
- "First Execution Instruction" that asks for `TECHNICAL_ASSESSMENT.md`, `MVP_ARCHITECTURE.md`, and a proposed migration before coding.

Those steps have already been completed.

Do not create a second migration 018.

Do not redesign the deployed schema to match older conceptual names.

## 4. Product Direction That Must Be Preserved

The product is:

**guided self-study + human coaching**

not hourly tutoring software and not a generic LMS.

Core model:

**Coach at the center. Software around the coach.**

Mental model:

**English Gym**

The learner should always understand:
- where they are;
- where they are going;
- what they should do next;
- what they completed;
- what the coach thinks;
- whether they are progressing.

The coach should quickly understand:
- who needs attention;
- what each learner is working on;
- what was submitted;
- what requires review;
- what should happen next.

Long-term product flow:

```text
Placement / Diagnosis
→ Personal Roadmap
→ Weekly Missions
→ Guided Self-study / Practice
→ Student Output
→ Human Coach Feedback
→ Revision / Accountability
→ Progress
→ Periodic Coaching Sessions
```

Vertical Slice 01 intentionally implements only the smallest complete center of this loop.

## 5. Product / Commercial Context

This is an experimental sellable MVP.

Validation target from Product Spec:
- first 3 paid pilot learners;
- then 10 paying learners.

Do not optimize for fundraising-scale architecture yet.

Do not build a full EdTech platform before the coaching loop is proven.

The product is intended to work for programs such as:
- TOEIC;
- IELTS;
- VSTEP;
- Foundation/general English;
- future English coaching tracks.

Do not hard-code the entire app around one exam.

## 6. Application Boundary

Existing product:

`test.e-master.vn`

Purpose:
- free/guest assessment;
- placement/mock testing;
- lead generation;
- results.

New product:

`learn.e-master.vn`

Purpose:
- authenticated Personal Coaching experience.

They are separate frontend applications sharing the same Supabase project and identity layer.

Do not turn the assessment frontend into the Coaching frontend.

Do not create a new Supabase project.

## 7. Existing Assessment App Is Production

Do not modify or weaken:
- guest assessment flow;
- existing assessment tables;
- `exam_leads`;
- `get_guest_result()`;
- assessment RLS;
- exam visibility;
- existing assessment submissions/results;
- `exam-audio`;
- existing auth behavior.

The assessment system intentionally supports anonymous/guest use.

The Coaching application is authenticated-only.

## 8. Existing Shared Identity

Reuse:
- Supabase Auth;
- `auth.users`;
- `public.profiles`;
- `public.get_user_role()`.

Role mapping:
- `student` → learner;
- `teacher` → coach;
- `admin` → administrator.

Do not create a `coach` role.

## 9. Fresh-Folder Bootstrap Rule

This `learn.e-master.vn` folder may initially contain only documentation.

Do not assume the assessment repository is inside this folder.

Before scaffolding, determine what local context is actually available.

If the existing `test.e-master.vn` repository is accessible as a sibling/known local path, inspect it **read-only** for:
- framework/package versions;
- Supabase browser/server client setup;
- auth/session pattern;
- environment-variable names;
- profile/role lookup;
- E-Master brand assets/design tokens;
- generic reusable components.

Do not modify that repository.

If it is NOT accessible, do not invent its stack or environment variable names.

Instead:
1. report exactly what reference information is unavailable;
2. scaffold the new app using a simple maintainable web stack consistent with the available project context;
3. document every required environment variable in `.env.example`;
4. never put secrets into source control.

Lack of the old frontend repository is not permission to create a second backend/auth system.

## 10. Brand / UX Baseline

Known E-Master colors:

- Master: `#2A4272`
- E-: `#3A8FDB`

Direction:
- modern;
- calm;
- premium but approachable;
- minimal;
- highly readable;
- mobile-first;
- action-oriented.

Avoid:
- excessive gradients;
- glassmorphism;
- decorative animation;
- dashboard clutter.

Student priority:
> What do I do next?

Coach priority:
> Who needs my attention?

## 11. Development Rules

- Never expose Supabase service-role credentials to browser code.
- Never disable RLS to make something work.
- Never silently broaden an RLS policy.
- Never execute production SQL without explicit human approval.
- Never modify the assessment app as part of this slice.
- Avoid premature abstractions.
- Avoid unnecessary dependencies.
- Do not fabricate successful security tests.
- If a genuine database/security blocker is found, STOP and report it before changing production.

## 12. Immediate Instruction

After reading all source-of-truth files:

1. inspect the current `learn.e-master.vn` folder;
2. inspect the old assessment repo read-only if it is locally available;
3. identify the actual stack/context available;
4. give a short implementation plan;
5. proceed directly with `VERTICAL_SLICE_01.md`;
6. do not repeat database architecture/migration work;
7. stop only for a genuine blocker or a change requiring human approval.
