# E-Master Personal Coaching — Architecture V1

## 1. Purpose

This document defines the technical boundary and architecture for the E-Master Personal Coaching MVP.

It is authoritative for implementation unless a later version explicitly supersedes it.

## 2. Product Boundary

E-Master currently has two separate web products:

### `test.e-master.vn`
Existing assessment and lead-generation application.

Primary responsibilities:
- guest/free placement and mock tests;
- exam content and exam delivery;
- exam submissions and results;
- guest contact capture;
- result lookup using the existing guest flow.

### `learn.e-master.vn`
New authenticated Personal Coaching application.

Primary responsibilities:
- coaching enrollment;
- coach-to-student assignment;
- weekly plans;
- coaching tasks;
- student submissions;
- coach feedback and revision loops;
- later: roadmap, learning modules and other coaching features.

These are **separate frontend applications**.

Do not turn `test.e-master.vn` into the Coaching frontend.

## 3. Shared Backend

Both applications use the **same existing Supabase project**.

Shared infrastructure:
- `auth.users`
- `public.profiles`
- existing authentication/session model
- `public.get_user_role()`
- existing assessment database
- new Coaching database created by Migration 018

Do not create:
- another Supabase project;
- another user database;
- another authentication system;
- a duplicate profiles table.

## 4. Role Mapping

Existing roles remain the source of truth.

For Coaching:
- `student` = learner
- `teacher` = coach
- `admin` = administrator

Do not add a new `coach` role.

The existing guest/anonymous assessment behavior is separate from Coaching.

## 5. Authentication Boundary

`test.e-master.vn` intentionally allows anonymous/guest assessment use.

`learn.e-master.vn` is authenticated-only.

A Coaching user must have an authenticated Supabase session and a valid profile/role.

Normal frontend requests must use the logged-in user's Supabase session so Row Level Security is exercised.

Never expose the Supabase service-role key in browser code.

## 6. Assessment System Boundary

The Coaching app must not modify or weaken the existing assessment system.

Do not modify as part of Coaching implementation:
- guest assessment flow;
- `exam_leads`;
- `get_guest_result()`;
- assessment RLS;
- exam visibility behavior;
- existing exam submissions/results;
- `exam-audio`;
- `user_role`;
- guest authentication behavior.

The assessment product is an acquisition/diagnostic surface. Coaching is the authenticated paid-service/product surface.

## 7. Repository Strategy

Recommended local structure:

```text
E-Master/
├── test.e-master.vn/
│   └── existing assessment application
│
└── learn.e-master.vn/
    ├── docs/
    ├── src/
    └── new Coaching application
```

`learn.e-master.vn` should be scaffolded as a clean application.

Do not clone the entire assessment application and then delete exam-specific features.

The assessment repository may be inspected as a reference for:
- Supabase initialization;
- auth/session patterns;
- profile and role lookup;
- generic UI components;
- E-Master design tokens;
- environment-variable conventions.

Reuse generic patterns only when appropriate.

## 8. Database Ownership

Migration 018 v2.2 FINAL has already been executed successfully on the shared Supabase production project.

Post-migration metadata verification passed 8/8.

The Coaching frontend must consume the deployed schema.

Do not re-run or duplicate Migration 018 from the new frontend project.

Do not create a new migration merely because frontend code is being built.

If implementation discovers a genuine blocking database defect:
1. stop;
2. document the exact operation and error;
3. propose the minimum database fix;
4. do not weaken RLS or modify production silently.

## 9. Storage Architecture

Coaching submissions use the private Supabase Storage bucket:

`coaching-submissions`

Canonical path:

```text
{student_uuid}/{task_uuid}/{unique_filename}
```

Rules:
- bucket is private;
- no public URLs;
- do not use `exam-audio`;
- save only the storage path in `coaching_submissions.storage_path`;
- generate authenticated/signed access when required;
- never persist signed URLs in the database.

## 10. Security Model

The following are non-negotiable invariants:

1. A student can access only their own Coaching data.
2. A coach can access only learners assigned to that coach.
3. Students cannot directly edit coach feedback/review fields.
4. Coaches cannot directly edit student-owned submission content/identity fields through the review flow.
5. Coaching files are private.
6. Coaches can read submission files only for assigned learners/tasks.
7. Submission ownership is enforced at database level.
8. Session coach assignment is enforced at database level.
9. Existing guest assessment behavior remains untouched.

Do not solve RLS errors by adding broad policies.

## 11. Application Layers

### Student experience
Primary question:

> What should I do next?

The student interface should prioritize:
- current goal;
- current plan;
- next tasks;
- submission status;
- coach feedback;
- revision actions.

### Coach experience
Primary question:

> Who needs my attention?

The coach interface should prioritize:
- assigned learners;
- active weekly plans;
- submitted work awaiting review;
- revision status;
- next coaching action.

### Admin experience
For MVP, admin is operational setup rather than a full enterprise console.

Initial admin need:
- connect a student to a coach;
- define program/goal/baseline/target/target date.

## 12. UX Direction

The Coaching product should feel:
- simple;
- calm;
- personal;
- progress-oriented;
- mobile-friendly;
- premium but locally affordable/approachable.

Avoid turning the MVP into a generic LMS.

Do not prioritize:
- giant data tables for students;
- excessive analytics;
- gamification;
- complex settings;
- AI features;
- course-authoring complexity.

## 13. MVP Technical Principle

Build vertical slices, not infrastructure for hypothetical future features.

The first product proof is:

```text
Coach assigns work
→ Student completes work
→ Coach reviews
→ Student receives feedback
→ Student revises when needed
```

Only after this loop works reliably should the product expand into richer roadmaps, module libraries, video/self-study content, automation or AI.


## 14. Documentation Precedence

`PRODUCT_SPEC_V1.md` was created before the final database migration.

Use:
- Product Spec for product intent and long-term MVP experience;
- this Architecture document for current application/technical boundaries;
- `DATABASE_V1.md` for the deployed database contract;
- `VERTICAL_SLICE_01.md` for what is implemented now.

Do not re-run old Product Spec instructions that ask for a new Coaching migration or pre-migration architecture approval.

## 15. Fresh Repository Bootstrap

The new `learn.e-master.vn` repository may begin as an empty/fresh folder containing only `/docs`.

If `test.e-master.vn` is locally accessible, inspect it read-only before choosing framework/package versions or Supabase integration patterns.

If it is not accessible:
- do not guess its exact implementation;
- do not invent environment variable names and claim they match production;
- create `.env.example`;
- document required public Supabase configuration;
- ask for/consume the existing project's public Supabase URL/anon or publishable key through local environment configuration;
- never copy a service-role secret into client code.

## 16. Brand Baseline

Known E-Master colors:
- Master: `#2A4272`
- E-: `#3A8FDB`

The product is mobile-first.

Long-term Student navigation from Product Spec:
- Home
- Learn
- Progress
- Coach
- Profile

Long-term Coach navigation:
- Dashboard
- Students
- Modules

Vertical Slice 01 may implement only the routes/screens required for the current slice. Do not build empty feature areas merely to satisfy the long-term navigation list.
