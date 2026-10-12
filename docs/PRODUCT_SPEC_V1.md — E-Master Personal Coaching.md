# E-Master Personal Coaching — MVP Product Specification V1

## 0. PRODUCT STATUS

**Status:** Experimental MVP\
**Product:** E-Master Personal Coaching\
**Target:** First 3 paid pilot learners → then 10 paying learners\
**Development philosophy:** Sellable MVP, not full EdTech platform.

This MVP exists to validate whether learners will pay for and consistently use a structured English coaching model combining:

- personal diagnosis;
- personalized roadmap;
- guided self-study;
- weekly missions;
- human coach feedback;
- progress tracking;
- periodic coaching sessions.

The product should make the learner feel:

> “I always know what I need to do next, why I am doing it, and my coach knows whether I am actually progressing.”

---

# 1. CORE PRODUCT PRINCIPLE

This is NOT:

- a generic LMS;
- a video course marketplace;
- an AI tutor;
- a school management system;
- a replacement for the coach.

The product model is:

**Coach at the center. Software around the coach.**

The software should help:

### Student

Know:

- where I am;
- where I am going;
- what I need to do this week;
- what I have completed;
- what my coach thinks;
- whether I am improving.

### Coach

Know:

- which students need attention;
- what each student is working on;
- what they completed;
- what they submitted;
- where they are struggling;
- what should be assigned next.

---

# 2. PRODUCT MENTAL MODEL

## English Gym

Platform = gym + equipment\
Curriculum = training program\
Learning modules = exercises\
Assessment = measurement\
Coach = personal trainer\
Weekly coaching = PT session\
Weekly missions = workout plan\
Progress = measurable improvement

The platform should therefore emphasize:

**Today / This Week / Coach / Progress**

rather than:

**Courses / Videos / Content Library**

---

# 3. EXISTING TECHNICAL CONTEXT

There is an existing production Supabase project used by:

`test.e-master.vn`

The existing database includes:

- Supabase Auth;
- `profiles`;
- student / teacher / admin roles;
- exams;
- passages;
- questions;
- exam results;
- classes;
- class teachers;
- class students;
- existing exam/class assignments.

## CRITICAL DATABASE RULE

The existing production database must be treated as PRODUCTION.

Do NOT:

- delete existing tables;
- rename existing tables;
- modify existing assessment behavior;
- refactor existing production schema;
- remove existing RLS policies;
- replace existing auth logic;
- reuse the existing `assignments` table for coaching assignments.

All Coaching MVP database changes must be:

**ADDITIVE MIGRATIONS ONLY.**

Reuse:

`auth.users`

and:

`public.profiles`

as the shared identity layer.

Existing assessment results should remain the source for placement/baseline information when applicable.

Before executing ANY migration:

1. inspect current schema;
2. propose migration SQL;
3. explain tables, relationships, indexes and RLS;
4. STOP;
5. wait for explicit human approval.

Never automatically execute database migration against production.

---

# 4. APPLICATION

Preferred domain:

`learn.e-master.vn`

Responsive web application.

Priority:

1. Mobile web
2. Desktop web

Do NOT build native iOS/Android apps for V1.

---

# 5. USER ROLES

Reuse existing roles.

## Student

Can access only their own:

- profile;
- roadmap;
- weekly plans;
- assignments;
- submissions;
- feedback;
- progress;
- coaching sessions.

## Teacher

Teacher acts as Coach in MVP.

Can access:

- assigned coaching students;
- their roadmaps;
- weekly plans;
- assignments;
- submissions;
- feedback;
- progress;
- assessment results needed for coaching.

Do NOT introduce a new `coach` role in V1 unless technically necessary.

## Admin

Can manage all coaching records.

---

# 6. MVP NAVIGATION

## Student

Only five primary navigation items:

**Home**\
**Learn**\
**Progress**\
**Coach**\
**Profile**

Avoid complex navigation.

## Coach

Primary navigation:

**Dashboard**\
**Students**\
**Modules**

Student detail provides access to student-specific operations.

---

# 7. SCREEN 1 — STUDENT HOME

This is the most important student screen.

Purpose:

Within 5 seconds the learner should understand:

1. my goal;
2. my current level;
3. what I need to do now;
4. how much I completed this week;
5. when I meet my coach next.

Example:

---

Good evening, Minh

### YOUR GOAL

TOEIC

Baseline: 445\
Target: 600+

Progress visualization:

445 ━━━━━━━━━━━━━○ 600+

Target date: December 2026

---

### THIS WEEK

Week 04

Focus:

**Listening Part 3 — Understanding Purpose**

Progress:

3 / 5 missions completed

60%

---

### CONTINUE LEARNING

Card:

Listening Part 3\
Identifying Purpose

Estimated time: 12 min

[ Continue ]

---

### YOUR MISSIONS

✓ Vocabulary Review\
✓ Part 5 Practice\
✓ Listening Lesson\
○ Listening Practice\
○ Submit Speaking Task

Each mission should clearly show:

- title;
- type;
- completion state;
- due date if applicable.

---

### NEXT COACHING

Sunday, 19:00

Coach: [Coach Name]

[View Session]

---

### COACH NOTE

Example:

“Your listening accuracy improved this week. Focus on identifying speaker purpose before worrying about individual words.”

---

## Student Home Acceptance Criteria

Student can immediately see:

- goal;
- baseline;
- target;
- weekly focus;
- completion;
- next action;
- coach note;
- next coaching session.

Do not clutter this page with analytics.

---

# 8. SCREEN 2 — PERSONAL ROADMAP

Purpose:

Show the learner that their learning journey is personalized and finite.

Example:

### YOUR ROADMAP

Baseline\
TOEIC 445

↓

Target\
TOEIC 600+

---

### FOUNDATION

✓ Grammar Essentials\
✓ Vocabulary Core

### 450 → 500

✓ Part 5 Basics\
● Listening Part 3\
○ Reading Part 7

### 500 → 550

🔒 Advanced Listening\
🔒 Reading Speed

### 550 → 600+

🔒 Exam Strategy\
🔒 Full Mock Tests

---

Statuses:

- completed;
- active;
- upcoming;
- locked.

V1 roadmap can be manually created/assigned by coach/admin.

NO automatic AI roadmap generation required.

---

# 9. SCREEN 3 — LEARNING MODULE

A module should answer:

1. What am I learning?
2. Why does this matter to me?
3. What do I need to do?
4. What should I submit?

Example:

### Listening Part 3

**Identifying Purpose**

### WHY THIS MATTERS

“You answered only 42% of purpose questions correctly in your recent assessment.”

This section is important.

Personalization should be visible.

---

### MODULE CONTENT

Possible content blocks:

- text;
- image;
- embedded video;
- audio;
- external resource;
- downloadable file.

Do NOT build an overly complex WYSIWYG CMS in V1.

Simple structured content is enough.

---

### ACTIVITIES

Example:

▶ Learn — 7 min

📖 Example — 5 min

🎧 Practice — 10 questions

🎙 Submit — 1 speaking task

---

### MODULE COMPLETION

Show simple progress.

Example:

3 / 4 activities completed.

---

# 10. SCREEN 4 — ASSIGNMENT & SUBMISSION

This is one of the core differentiators from a normal LMS.

Assignment types V1:

- text response;
- file upload;
- audio recording;
- completion/check-off.

## HIGH PRIORITY FEATURE

**Audio recording submission**

Student should be able to:

1. open assignment;
2. read prompt;
3. grant microphone permission;
4. record audio;
5. listen before submission;
6. re-record;
7. submit.

Store recordings in Supabase Storage.

Recordings must NOT be publicly accessible.

Use private storage with appropriate access control / signed URLs.

Example:

### SPEAKING TASK

Tell me about your typical weekday.

Target:

60–90 seconds

Focus:

- present simple;
- frequency expressions;
- clear pronunciation.

[Record]

00:00 ━━━━━━━━━━━━━

[Stop]

[Listen]

[Record Again]

[Submit]

---

After submission:

Status:

**Submitted — Waiting for Coach Feedback**

After feedback:

**Coach Reviewed**

---

# 11. SCREEN 5 — PROGRESS

V1 should remain simple.

Do NOT build advanced analytics.

Show:

### Goal Progress

Baseline → Current → Target

Example:

445 → 485 → 600+

### Weekly Adherence

Example:

Week 1 — 80%\
Week 2 — 60%\
Week 3 — 100%\
Week 4 — 75%

### Assessment History

Date\
Assessment\
Score

### Mission Completion

Completed / Assigned

### Skill Progress

If data exists:

Listening\
Reading\
Speaking\
Writing

or TOEIC-specific skills.

Do not fabricate skill scores when no assessment data exists.

---

# 12. SCREEN 6 — COACH DASHBOARD

Purpose:

Coach should identify students requiring intervention within seconds.

Top:

### ACTIVE STUDENTS

18

### NEED ATTENTION

Examples:

Minh — 3 days inactive

Lan — Assignment overdue

Huy — Listening accuracy below target

Trang — New submission waiting for feedback

---

### STUDENTS

Table/cards:

Student | Goal | Week | Adherence | Status

Example:

Minh | TOEIC 600+ | W04 | 82% | Improving\
Lan | VSTEP B1 | W07 | 61% | Needs attention\
Huy | TOEIC 650 | W03 | 94% | On track

Do NOT create complex predictive alerts.

V1 alerts should be based on deterministic rules.

Examples:

- overdue assignment;
- no activity X days;
- submission awaiting review;
- weekly completion below threshold.

---

# 13. SCREEN 7 — COACH STUDENT DETAIL

Tabs:

**Overview**\
**Roadmap**\
**Assignments**\
**Submissions**\
**Assessments**\
**Notes**

## Overview

Show:

- student;
- goal;
- baseline;
- target;
- current focus;
- weekly adherence;
- recent activity;
- next session;
- latest coach note.

## Roadmap

Coach can:

- view roadmap;
- add roadmap item;
- assign module;
- change status.

## Assignments

Coach can:

- create assignment;
- assign existing module;
- set due date;
- mark priority.

## Submissions

Coach can:

- view/listen to submission;
- enter feedback;
- mark reviewed.

## Assessments

Read existing relevant assessment results from the existing E-Master assessment system.

Do NOT duplicate assessment results into coaching tables unless there is a strong technical reason.

## Notes

Private coach notes.

Student must NOT automatically see private coach notes.

Separate:

**Private Coach Note**

from:

**Student-visible Feedback**

---

# 14. COACHING SESSION OBJECT

Create a lightweight coaching session object.

Fields should support:

- student;
- coach;
- scheduled date/time;
- duration;
- location type;
- meeting URL OR physical location;
- status;
- agenda;
- pre-session tasks;
- session summary;
- next-step note.

Example student view:

### SESSION #4

Sunday, 18 October\
19:00

Before Session:

✓ Complete Part 3 Module\
✓ Listening Practice\
○ Submit speaking recording

Agenda:

1. Weekly progress
2. Review listening errors
3. Targeted Part 3 practice
4. Speaking correction
5. Next week's plan

Meeting:

[Join Google Meet]

Do NOT build native video conferencing.

---

# 15. MODULE LIBRARY

Coach needs reusable modules.

Example codes:

T-P5-001\
Subject–Verb Agreement

T-P5-002\
Word Forms

T-P3-004\
Identifying Purpose

F-SPK-003\
Daily Routine

F-LIS-006\
Numbers & Time

Recommended module fields:

- id;
- code;
- title;
- description;
- program/track;
- skill;
- level;
- estimated_minutes;
- content;
- status;
- created_by;
- created_at;
- updated_at.

Content architecture should remain simple enough to change during pilot.

Do NOT create an elaborate course-authoring engine.

---

# 16. PROPOSED DATA DOMAIN

Exact SQL must be proposed separately after inspecting existing production schema.

Conceptually V1 likely requires entities similar to:

### coaching_students

Relationship between student and coach.

Possible data:

- id;
- student_id;
- coach_id;
- program;
- goal;
- baseline;
- target;
- target_date;
- status;
- started_at.

### coaching_roadmaps

- id;
- coaching_student_id;
- title;
- status.

### coaching_roadmap_items

- id;
- roadmap_id;
- module_id;
- sequence;
- status;
- coach_reason.

### learning_modules

Reusable learning modules.

### coaching_weekly_plans

- id;
- coaching_student_id;
- week_start;
- focus;
- coach_message;
- status.

### coaching_assignments

DO NOT confuse with existing `assignments`.

- id;
- weekly_plan_id;
- student_id;
- module_id nullable;
- title;
- instructions;
- assignment_type;
- due_at;
- status.

### coaching_submissions

- id;
- coaching_assignment_id;
- student_id;
- text_response nullable;
- file_path nullable;
- audio_path nullable;
- submitted_at;
- status.

### coaching_feedback

- id;
- submission_id;
- coach_id;
- feedback_text;
- created_at.

### coaching_sessions

- id;
- coaching_student_id;
- coach_id;
- scheduled_at;
- duration_minutes;
- location_type;
- meeting_url;
- physical_location;
- agenda;
- summary;
- next_steps;
- status.

### coaching_notes

- id;
- coaching_student_id;
- coach_id;
- content;
- visibility;
- created_at.

These are conceptual entities.

Do NOT blindly create these tables.

Inspect existing schema first and propose the minimum normalized structure.

---

# 17. ROW LEVEL SECURITY

RLS is mandatory.

## Student

Student may only:

- read their coaching relationship;
- read their roadmap;
- read their weekly plans;
- read assignments assigned to them;
- create/read their own submissions;
- read feedback addressed to them;
- read their student-visible session data;
- read student-visible notes.

Student must NOT:

- access other students;
- access private coach notes;
- change coach feedback;
- change assessment results;
- access admin data.

## Coach

Coach may access only students assigned to them, except if existing admin permissions allow otherwise.

Coach may:

- read assigned student profile;
- read relevant assessment results;
- manage roadmap;
- manage weekly plans;
- assign modules;
- review submissions;
- create feedback;
- manage coaching sessions;
- create private notes.

## Admin

Admin may manage all coaching domain records.

Use existing role helper/patterns where appropriate.

Do not weaken existing production RLS.

---

# 18. STORAGE

Supabase Storage may be used for:

- audio submissions;
- student-uploaded files;
- learning resources if appropriate.

Suggested logical path:

`coaching-submissions/{student_id}/{assignment_id}/{file}`

Bucket should be PRIVATE.

Access must respect student/coach relationship.

Never expose Supabase service-role credentials to browser/client code.

---

# 19. ACTIVITY & ADHERENCE

V1 should calculate simple adherence.

Example:

Weekly adherence =

completed required assignments / total required assignments

Do NOT introduce complicated scoring.

Coach dashboard can use this to identify low adherence.

Store enough timestamps to calculate:

- assigned;
- opened if easy;
- submitted;
- completed;
- reviewed.

Do not build full event analytics infrastructure for V1.

---

# 20. NEED ATTENTION RULES

Deterministic rules only.

Potential V1:

### OVERDUE

Assignment due date passed and not submitted.

### INACTIVE

No completed/submitted activity for X days.

### REVIEW NEEDED

Submission exists and has no coach feedback.

### LOW ADHERENCE

Weekly completion below configured threshold.

These rules can initially be calculated dynamically.

No AI prediction required.

---

# 21. EXPLICITLY OUT OF SCOPE — V1

DO NOT BUILD:

- AI tutor;
- AI roadmap generator;
- AI automatic grading unless already available elsewhere;
- native mobile apps;
- community;
- social feed;
- internal chat;
- native video calls;
- payment system;
- subscription billing;
- complex calendar/scheduling engine;
- gamification;
- badges;
- streak system;
- leaderboards;
- marketplace;
- B2B multi-tenant SaaS;
- white labeling;
- advanced analytics;
- recommendation engine;
- automated content generation;
- complex notification engine;
- parent portal;
- CRM;
- sales pipeline;
- certificates;
- full school management system.

Use existing external tools where practical:

- Zalo for messaging;
- Google Meet for calls;
- existing E-Master processes for payment;
- existing assessment system for testing.

---

# 22. UI / UX DIRECTION

Style:

- modern;
- calm;
- premium but approachable;
- minimal;
- mobile-first;
- highly readable;
- action-oriented.

Use existing E-Master branding where appropriate.

Known brand colors:

Master:\
`#2A4272`

E-:\
`#3A8FDB`

Avoid excessive gradients, glassmorphism, animations or dashboard clutter.

Student UI should feel encouraging.

Coach UI should feel operational.

The student should rarely need to ask:

> “What do I do now?”

There should almost always be one obvious primary next action.

---

# 23. PRODUCT EXPERIENCE PRIORITY

When tradeoffs occur, prioritize in this order:

1. Clear next action
2. Coach personalization
3. Submission / feedback loop
4. Progress visibility
5. Mobile usability
6. Visual polish
7. Automation

---

# 24. DEMO DATA

Create seed/demo data only in development environment.

Create:

### Demo Student

Name:\
Demo Student

Goal:\
TOEIC 600+

Baseline:\
445

Target:\
600

Weekly focus:\
Listening Part 3

Adherence:\
60%

Include:

- roadmap;
- 5 weekly missions;
- 3 completed;
- 2 incomplete;
- one audio assignment;
- one coach note;
- one upcoming coaching session;
- assessment history.

### Demo Coach

Name:\
Demo Coach

Include several demo students showing:

- on track;
- overdue;
- inactive;
- awaiting feedback.

This is important because MVP will be used as a sales demo.

---

# 25. MVP DEFINITION OF DONE

MVP is DONE when the following full loop works:

### Admin/Coach

1. Existing user logs in.
2. Coach can access Coaching Dashboard.
3. Coach can select a student.
4. Coach can create/assign roadmap.
5. Coach can create weekly plan.
6. Coach can assign learning module/task.

### Student

7. Student logs in using shared E-Master identity.
8. Student sees personalized Home.
9. Student sees goal and weekly plan.
10. Student opens assigned module.
11. Student completes activity.
12. Student records/uploads audio or submits response.
13. Student sees submission status.

### Coach

14. Coach sees new submission.
15. Coach reviews/listens.
16. Coach sends feedback.
17. Coach updates progress/next plan.

### Student

18. Student sees coach feedback.
19. Student sees updated weekly progress.
20. Student sees next coaching session.

If this loop works reliably on mobile web and desktop:

**SHIP THE MVP.**

Do not delay launch for additional features.

---

# 26. DEVELOPMENT PROCESS

## Phase 1 — Inspect

Before coding:

- inspect existing repo;
- inspect stack;
- inspect current Supabase integration;
- inspect existing auth;
- inspect existing production schema;
- identify reusable components.

Output:

`TECHNICAL_ASSESSMENT.md`

Do not modify production.

---

## Phase 2 — Architecture

Produce:

`MVP_ARCHITECTURE.md`

Include:

- proposed routes;
- components;
- data flow;
- proposed database additions;
- storage strategy;
- RLS strategy;
- migration plan.

Produce SQL migration separately.

STOP FOR HUMAN REVIEW.

---

## Phase 3 — Database Review

Generate:

`supabase/migrations/[timestamp]_coaching_mvp.sql`

BUT DO NOT EXECUTE IT.

Explain:

- each table;
- each FK;
- each index;
- each RLS policy;
- any interaction with existing schema.

Wait for explicit approval.

---

## Phase 4 — Build

After migration approval:

Build the smallest complete vertical slice:

Coach assign task\
→ Student sees task\
→ Student submits\
→ Coach reviews\
→ Student sees feedback.

Then expand to roadmap/progress/session views.

---

## Phase 5 — QA

Test:

### Authentication

Student / teacher / admin.

### RLS

Attempt unauthorized cross-student access.

### Mobile

Test common mobile viewport sizes.

### Audio

Test microphone permission, record, playback, re-record, submit.

### Failure states

Upload failure.\
Network interruption.\
Missing data.\
Expired session.

### Existing Exam Center

Verify existing `test.e-master.vn` functionality is unaffected.

---

# 27. DEVELOPMENT RULES FOR AI CODING AGENT

1. Never execute destructive SQL.
2. Never modify production without approval.
3. Never expose service-role key.
4. Never disable RLS as a shortcut.
5. Never rewrite existing auth unless required and approved.
6. Prefer simple architecture.
7. Avoid premature abstractions.
8. Avoid unnecessary dependencies.
9. Reuse existing code/components when sensible.
10. Keep migrations in Git.
11. Document environment variables.
12. Add README instructions for local development and deployment.
13. Explain architecture decisions that affect maintainability.
14. If uncertain, STOP and ask instead of guessing.
15. Do not expand scope beyond this specification.

---

# 28. FIRST EXECUTION INSTRUCTION

Do NOT begin implementing the entire application immediately.

Execute only:

### STEP 1

Inspect the existing project/repository and existing Supabase integration.

### STEP 2

Read the current production schema supplied in the project.

### STEP 3

Create:

`TECHNICAL_ASSESSMENT.md`

and:

`MVP_ARCHITECTURE.md`

### STEP 4

Generate the proposed additive Coaching MVP migration SQL.

DO NOT EXECUTE THE MIGRATION.

### STEP 5

Report:

- existing architecture discovered;
- what can be reused;
- proposed database additions;
- security/RLS approach;
- risks;
- ambiguities;
- estimated implementation phases;
- files you propose to create/change.

Then STOP and wait for human approval.

Do not write production database changes until approval is explicitly given.
