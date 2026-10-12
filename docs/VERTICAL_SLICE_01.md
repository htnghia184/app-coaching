# E-Master Personal Coaching — Vertical Slice 01

## 1. Objective

Build the first usable end-to-end Coaching workflow on top of the already deployed Coaching database.

The slice must prove:

```text
Coach assigns work
→ Student completes work
→ Coach reviews
→ Student receives feedback
→ Student revises when requested
```

This is not a full LMS build.

## 2. Source of Truth

Before implementation, read:

1. `00_READ_ME_FIRST.md`
2. `PRODUCT_SPEC_V1.md`
3. `ARCHITECTURE_V1.md`
4. `DATABASE_V1.md`
5. this document

Precedence:
- Product Spec = product intent and long-term MVP direction.
- Architecture + Database = current technical truth after Migration 018.
- This Vertical Slice = current implementation scope.

The Product Spec contains historical pre-migration execution instructions. Do NOT repeat those steps.

If repository behavior conflicts with current Architecture/Database truth, report the conflict instead of silently redesigning the product or weakening security.

## 3. Existing Backend Status

Migration 018 v2.2 FINAL is already deployed successfully.

Do not execute it again.

Do not create another Supabase project.

Use:
- existing Supabase project;
- existing auth/users/profiles;
- existing role model;
- deployed Coaching tables/RPCs/storage.

## 4. Authentication Routing

Reuse existing Supabase authentication/session patterns where possible.

After authentication, determine the user's role from the existing profile system.

Route:
- `student` → Student Coaching Dashboard
- `teacher` → Coach Dashboard
- `admin` → minimal Admin Coaching Setup

Do not rebuild authentication unnecessarily.

Coaching is authenticated-only.

## 5. Admin — Minimal Enrollment Setup

Build only enough admin functionality to start a Coaching relationship.

Admin can create a Coaching enrollment with:

- Student
- Coach
- Program
- Goal
- Baseline
- Target
- Target date

Student selector:
- existing profiles where role = `student`

Coach selector:
- existing profiles where role = `teacher`

Create:
- `coaching_enrollments`

Do not build:
- CRM;
- billing;
- packages;
- full user management.

## 6. Coach Dashboard

Show only learners assigned to the logged-in coach.

Rely on RLS.

Never use a browser-side service-role key.

Learner card:
- name
- program
- goal
- status
- target date

Click learner → Coaching Workspace.

Primary coach question:

> Who needs my attention?

## 7. Coaching Workspace

Header:
- learner name
- program
- goal
- baseline
- target
- target date

### Weekly Plan

Coach can create:

- week number
- title
- focus
- coach message
- start date
- end date

Insert into:
- `coaching_weekly_plans`

### Tasks

Coach can create:

- title
- instructions
- task type
- due date
- required/optional

For this slice expose only:
- `text`
- `audio`
- `file`
- `checkoff`

Insert into:
- `coaching_tasks`

Order tasks by `sequence`.

Do not expose all database task types yet.

## 8. Student Dashboard

Show only the logged-in student's Coaching data.

Display:
- program
- goal
- baseline
- target
- target date
- coach name if available
- current weekly plan
- ordered tasks

Task status labels:
- Not started
- Draft
- Submitted
- Revision requested
- Reviewed

Primary student question:

> What should I do next?

## 9. Student Task Detail

### Text

Student can enter/save/submit a text response.

### Audio

Student can:
- record audio in browser if cleanly supported by the current stack; or
- upload an audio file.

Prefer browser recording only if it does not require a large dependency or fragile implementation.

### File

Student can upload a supported file.

### Checkoff

Student can submit task completion without requiring rich content.

## 10. Creating a Submission

If no submission exists, create a valid row using the authenticated student's session.

Requirements:
- `student_id = auth.uid()`
- task must belong to that student's enrollment;
- do not populate coach feedback/review fields.

Initial status:
- `draft` when saving without final submission; set `submitted_at = null`;
- `submitted` when submitting; explicitly set `submitted_at` to the submission time because this column has no database default.

Do not populate any feedback/review fields.

## 11. Updating Student Work

Do not directly UPDATE `coaching_submissions`.

Use:

`update_own_coaching_submission(...)`

This is mandatory for existing submissions.

The student UI must never provide a path to modify:
- feedback;
- reviewer identity/time;
- task ownership;
- student ownership.

## 12. Private File Handling

Bucket:
- `coaching-submissions`

Path:
```text
{auth.uid()}/{task_id}/{unique_filename}
```

Rules:
- no public URLs;
- do not use `exam-audio`;
- save only Storage path in submission row;
- use authenticated/signed access for private files;
- do not persist signed URLs.

## 13. Coach Submission Review

Coach can view submissions only for assigned learners.

Display:
- status
- submitted time
- text response
- private attachment/audio
- duration when relevant
- existing feedback

Review form:
- feedback text
- optional feedback score
- request revision checkbox

For this slice:
- `feedback_data = {}`

Do not directly UPDATE `coaching_submissions`.

Use:

`review_coaching_submission(...)`

Expected result:
- request revision false → `reviewed`
- request revision true → `revision_requested`

Refresh UI after successful review.

## 14. Revision Loop

Required:

```text
Student submits
→ submitted

Coach requests revision
→ revision_requested

Student edits/resubmits via student RPC
→ submitted

Coach reviews again
→ reviewed
```

Previous coach feedback may remain visible during revision.

Do not automatically delete prior feedback.

## 15. UI Direction

The interface should feel like personal Coaching, not enterprise LMS software.

Prioritize:
- simple;
- calm;
- mobile-friendly;
- personal;
- progress-oriented;
- low cognitive load;
- E-Master visual identity where practical.

Do not spend excessive time polishing visual design before the core loop works.

Avoid:
- giant student tables;
- excessive charts;
- gamification;
- dense settings;
- unnecessary navigation.

## 16. Explicitly Out of Scope

Do not build in Vertical Slice 01:

- payments;
- subscriptions;
- packages;
- chat/messaging;
- notifications;
- calendar integration;
- video calls;
- AI coach;
- AI grading;
- AI study-plan generation;
- analytics dashboards;
- gamification;
- certificates;
- community;
- group classes;
- marketplace;
- parent accounts;
- native mobile app;
- complex admin dashboard;
- automated onboarding;
- automatic placement-test import;
- roadmap builder;
- learning-module authoring UI;
- video course library.

## 17. Assessment App Protection

Do not modify:
- `test.e-master.vn` assessment UI;
- guest assessment flow;
- `exam_leads`;
- `get_guest_result()`;
- assessment RLS;
- exam visibility;
- exam submissions/results;
- `exam-audio`;
- guest auth behavior.

If code from the assessment repository is used as reference, copy/reuse only generic patterns intentionally.

## 18. Security Requirements

Normal app queries must use the authenticated user's Supabase session.

Do not bypass RLS.

Never expose service-role credentials in frontend code.

If an intended operation is blocked by RLS:
1. stop;
2. report the authenticated role;
3. report table/RPC/storage operation;
4. report exact Supabase error;
5. explain expected behavior.

Do not add broad policies as a workaround.

## 19. Required End-to-End Smoke Test

Use at minimum:
- Student A
- Student B
- Coach A
- Coach B if available
- Admin

Create:
- Student A → Coach A enrollment

### Positive flow

Admin:
- creates enrollment.

Coach A:
- sees Student A;
- creates weekly plan;
- creates task.

Student A:
- sees task;
- submits response/file.

Coach A:
- sees submission;
- gives feedback.

Student A:
- sees feedback.

Coach A:
- requests revision.

Student A:
- revises/resubmits.

Coach A:
- completes review.

### Negative tests

Student B must not:
- see Student A enrollment;
- see Student A plan;
- see Student A task;
- see Student A submission;
- read Student A private file.

Coach B must not:
- see Student A workspace;
- review Student A submission;
- read Student A private file.

Student A must not:
- directly modify feedback;
- modify `reviewed_by`;
- modify `reviewed_at`;
- change `student_id`;
- change `task_id`.

Coach A review flow must not:
- modify student response text;
- change submission student/task ownership.

Do not report fake PASS results.

Only report tests actually executed.

## 20. Implementation Sequence

1. Inspect new repository structure.
2. Read all `/docs` source-of-truth files.
3. Inspect the assessment repository only as needed for reusable generic patterns.
4. Identify auth/session/Supabase conventions.
5. Identify reusable generic UI/design tokens.
6. Produce a short implementation plan.
7. Continue implementation without waiting unless a genuine blocker exists.
8. Implement role routing.
9. Implement minimal admin enrollment setup.
10. Implement Coach Dashboard.
11. Implement Coaching Workspace.
12. Implement weekly plan/task creation.
13. Implement Student Dashboard.
14. Implement Student Task Detail.
15. Implement submission creation and student RPC updates.
16. Implement private file upload/read.
17. Implement coach review RPC.
18. Test revision loop.
19. Run typecheck/lint/build.
20. Run available automated tests.
21. Perform real authenticated security smoke tests that the environment permits.
22. Report results.

## 21. Definition of Done

Vertical Slice 01 is done only when:

- authenticated role routing works;
- Admin can create Coaching enrollment;
- Coach sees assigned learner;
- Coach creates weekly plan;
- Coach creates task;
- Student sees task;
- Student submits;
- private file upload works;
- Coach reviews through safe RPC;
- Student sees feedback;
- revision loop works;
- RLS is not bypassed;
- assessment app remains unaffected;
- typecheck/build succeeds;
- actual smoke-test results are documented.

## 22. Completion Report

Report:

### Files changed
Every created/modified file.

### Functional flow
What works end-to-end.

### Security tests
PASS / FAIL / NOT EXECUTED for each test.

### Build/test results
Commands and actual results.

### Known limitations
Only limitations actually discovered.

### Database changes
Expected statement:

`No additional database migration created`

If a blocking DB defect is discovered, stop and report before modifying the database.


## 23. Scope Clarification Against Full Product Spec

The full Product Spec describes the broader MVP, including:
- personalized roadmap;
- progress screen;
- coaching sessions;
- module library;
- assessment history;
- adherence/need-attention rules;
- broader student/coach navigation.

Those remain valid product direction, but they are **not all part of Vertical Slice 01**.

Do not build them merely because they exist in Product Spec.

Vertical Slice 01 proves the central human-coaching loop first.

After this slice passes real end-to-end/security testing, later slices may expand toward the full Product Spec.

## 24. Fresh-Folder Rule

This app may be starting from a nearly empty folder.

Before coding:
- inspect what files actually exist;
- do not assume framework/package versions;
- do not assume the old assessment repository is available;
- do not invent production environment values.

If the old repo is available locally, inspect it read-only for reusable generic patterns.

If it is unavailable, proceed with the simplest maintainable implementation supported by available context, create `.env.example`, and clearly list what production/public configuration the human must provide.

Never use this uncertainty as a reason to create a new Supabase project or auth system.
