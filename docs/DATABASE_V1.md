# E-Master Personal Coaching — Database V1

## 1. Status

Database version: **Migration 018 v2.2 FINAL HARDENED IDEMPOTENT**

Status:
- deployed successfully to the shared Supabase production project;
- post-migration metadata verification passed 8/8;
- this document describes the logical contract the frontend should use.

Do not re-create these tables from frontend code.

## 2. Shared Identity

Coaching reuses:

- `auth.users`
- `public.profiles`
- `public.get_user_role()`

Role mapping:
- `student` = learner
- `teacher` = coach
- `admin` = administrator

No separate `coach` role exists.

## 3. Coaching Tables

### `learning_modules`

Reusable learning content metadata.

Important fields:
- `id`
- `title`
- `description`
- `program`
- `skill`
- `level`
- `content jsonb`
- `estimated_minutes`
- `is_published`
- `created_by`
- timestamps

Not required for Vertical Slice #1 authoring UI.

### `coaching_enrollments`

Represents the Coaching relationship between one student and one assigned coach.

Important fields:
- `student_id`
- `coach_id`
- `program`
- `goal_label`
- `baseline_data jsonb`
- `target_data jsonb`
- `target_date`
- `status`
- `started_at`
- timestamps

`baseline_data` and `target_data` are JSONB because score semantics vary by program.

Examples:

TOEIC:
```json
{
  "overall": 450,
  "listening": 230,
  "reading": 220
}
```

IELTS:
```json
{
  "overall": 5.5,
  "listening": 6,
  "reading": 6,
  "writing": 5,
  "speaking": 5
}
```

### `coaching_roadmaps`

High-level roadmap attached to an enrollment.

Important fields:
- `enrollment_id`
- `title`
- `status`
- timestamps

Roadmap UI is not required in Vertical Slice #1.

### `coaching_roadmap_items`

Ordered roadmap steps.

Important fields:
- `roadmap_id`
- optional `module_id`
- `title`
- `description`
- `sequence`
- `status`
- timestamps

Roadmap UI is not required in Vertical Slice #1.

### `coaching_weekly_plans`

A coach-created weekly plan for an enrollment.

Important fields:
- `enrollment_id`
- `week_number`
- `title`
- `focus`
- `coach_message`
- `starts_on`
- `ends_on`
- `status`
- timestamps

Constraint:
- unique `(enrollment_id, week_number)`.

### `coaching_tasks`

Actionable work inside a weekly plan.

Important fields:
- `weekly_plan_id`
- optional `module_id`
- optional `exam_id`
- `task_type`
- `title`
- `instructions`
- `sequence`
- `due_at`
- `is_required`
- timestamps

Database-supported task types:
- `lesson`
- `practice`
- `text`
- `audio`
- `file`
- `checkoff`
- `assessment`

Vertical Slice #1 UI should expose only:
- `text`
- `audio`
- `file`
- `checkoff`

### `coaching_submissions`

Student work and coach review state.

Student-owned fields:
- `task_id`
- `student_id`
- `text_response`
- `storage_path`
- `duration_seconds`
- submission status/time

Coach-owned review fields:
- `feedback_text`
- `feedback_score`
- `feedback_data`
- `reviewed_by`
- `reviewed_at`

Status:
- `draft`
- `submitted`
- `reviewed`
- `revision_requested`

There is one submission per `(task_id, student_id)`.

### `coaching_sessions`

Scheduled coaching sessions.

Important fields:
- `enrollment_id`
- `coach_id`
- `scheduled_at`
- `duration_minutes`
- `location_type`
- `meeting_url`
- `physical_location`
- `agenda`
- `summary`
- `next_steps`
- `status`
- timestamps

Session UI is not required for Vertical Slice #1.

## 4. Core Relationships

```text
profiles
  │
  ├── student_id ──────┐
  └── coach_id ────────┤
                       ▼
             coaching_enrollments
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
 coaching_roadmaps  weekly_plans  coaching_sessions
          │            │
          ▼            ▼
 roadmap_items      coaching_tasks
                       │
                       ▼
                coaching_submissions

learning_modules ── optional references ──► roadmap_items/tasks
exams ───────────── optional reference ───► coaching_tasks
```

## 5. Database Integrity

### Submission ownership

Database trigger:

`validate_coaching_submission`

ensures:

```text
coaching_submissions.student_id
=
student assigned to the task's enrollment
```

Frontend must not attempt to override this.

### Session coach ownership

Database trigger:

`validate_coaching_session`

ensures:

```text
coaching_sessions.coach_id
=
coach assigned to the enrollment
```

## 6. Student Submission RPC

Function:

`public.update_own_coaching_submission(...)`

Purpose:
- safely modify an existing student submission;
- prevent student access to coach-controlled fields.

The frontend must use this RPC instead of directly updating `coaching_submissions`.

Student RPC may change:
- `text_response`
- `storage_path`
- `duration_seconds`
- `status`
- `submitted_at`
- `updated_at`

It must not be used to change:
- `task_id`
- `student_id`
- `feedback_text`
- `feedback_score`
- `feedback_data`
- `reviewed_by`
- `reviewed_at`

The function is `SECURITY DEFINER` but verifies authenticated student ownership internally.

## 7. Coach Review RPC

Function:

`public.review_coaching_submission(...)`

Purpose:
- safely review a submission without giving coaches generic UPDATE access to student-owned submission fields.

Coach RPC may change:
- `feedback_text`
- `feedback_score`
- `feedback_data`
- `reviewed_by`
- `reviewed_at`
- `status`
- `updated_at`

It must not change:
- `task_id`
- `student_id`
- `text_response`
- `storage_path`
- `duration_seconds`
- `submitted_at`

The function verifies:
- authenticated user;
- `teacher` role;
- submission belongs to an enrollment assigned to that teacher;
- submission is in a reviewable state.

## 8. RLS Contract

### Student

Student may:
- view own Coaching enrollment/data;
- view own weekly plans/tasks;
- view own submissions;
- insert a valid own submission;
- update own existing submission only through the safe RPC.

Student may not:
- view another student's Coaching data;
- directly update coach feedback;
- change submission ownership.

### Coach

Coach may:
- view assigned enrollments;
- manage assigned roadmap/weekly-plan/task structures;
- view assigned learner submissions;
- review submissions through the safe review RPC.

Coach does not have generic UPDATE permission on `coaching_submissions`.

### Admin

Admin has full operational management access to Coaching domain objects.

## 9. Storage

Bucket:

`coaching-submissions`

Configuration:
- private;
- 50 MB file-size limit;
- MIME allowlist configured by Migration 018.

Canonical path:

```text
{student_uuid}/{task_uuid}/{unique_filename}
```

Student:
- can upload/read/update/delete own valid task files.

Coach:
- can read files only when both the student and task belong to an enrollment assigned to that coach.

Admin:
- full Coaching bucket management.

No anonymous Coaching Storage policy exists.

Do not use public URLs.

## 10. Identity Deletion Semantics

Important Coaching identity foreign keys intentionally use `ON DELETE RESTRICT`.

This means Coaching history can block hard deletion of a participating student/coach.

This is intentional.

Preferred future behavior:
- archive/deactivate accounts;
- preserve educational/coaching history.

Do not change these foreign keys to CASCADE merely to make user deletion easier.

## 11. Automatic Timestamps

All Coaching tables with `updated_at` use the shared Coaching updated-at trigger introduced by Migration 018.

Frontend code should not rely on manually maintaining timestamps unless required by a specific RPC contract.

## 12. Assessment Boundary

The shared database also contains the existing assessment system.

Coaching implementation must not modify:
- assessment tables;
- guest exam policies;
- `exam_leads`;
- `get_guest_result()`;
- `exam-audio`;
- exam visibility behavior.

`coaching_tasks.exam_id` exists only as an optional future/integration reference. Do not redesign the assessment schema around Coaching.

## 13. Production Verification

The deployed Migration 018 passed:

- 8/8 Coaching tables;
- 8/8 RLS enabled;
- 5/5 required functions;
- Student RPC is SECURITY DEFINER;
- Coach RPC is SECURITY DEFINER;
- zero forbidden generic Coach UPDATE policies on submissions;
- private 50 MB Coaching bucket;
- 6/6 Coaching Storage policies.

Frontend implementation should now validate behavior end-to-end using authenticated sessions rather than weakening database controls.


## 14. Important Frontend Contract — First Submission

`coaching_submissions.submitted_at` has no database default.

When creating a NEW submission directly through INSERT:

### Save draft
Set:
- `status = 'draft'`
- `submitted_at = null`

### Submit immediately
Set:
- `status = 'submitted'`
- `submitted_at = current client/server timestamp`

For an EXISTING submission, do not directly UPDATE the row. Use `update_own_coaching_submission(...)`; when `p_submit = true`, that RPC sets `submitted_at = now()`.

Do not populate feedback/review fields during student INSERT.

## 15. Product Spec Database Notes Are Historical/Conceptual

The older Product Spec contains a section named "Proposed Data Domain" with conceptual entities such as:
- `coaching_students`;
- `coaching_assignments`;
- separate `coaching_feedback`;
- `coaching_notes`.

Those were design-stage concepts, not the deployed schema.

The deployed Migration 018 schema described in this file is authoritative.

Examples:
- use `coaching_enrollments`, not `coaching_students`;
- use `coaching_tasks`, not `coaching_assignments`;
- feedback fields currently live on `coaching_submissions`;
- no `coaching_notes` table exists in Migration 018.

Do not create missing conceptual tables merely because they appear in the older Product Spec.

If a later vertical slice genuinely requires a missing domain object, propose it separately and wait for approval before any production migration.
