# E-Master IELTS Coaching — Product Blueprint v0.1
**Status:** Proposed architecture, not an approved database migration or implementation specification.
**Product definition:** A human-led, personalized 1:1 coaching service. The platform is the coach's operational system; content and AI support coaching decisions.
**Evidence base:** inspected `README.md`, `docs/DATABASE_V1.md`, `docs/VERTICAL_SLICE_01.md`, `src/lib/types.ts`, `src/modules/moduleService.ts`, `src/modules/ree.ts`, `src/modules/InteractionRegistry.tsx`, `src/modules/LearningModulePreview.tsx`, `src/pages/ModulePlayer.tsx`, `src/pages/AdminModules.tsx`, `src/pages/CoachWorkspace.tsx`, `src/App.tsx`. This is a source-code/document review, **not** a live authenticated audit.

## 1. Product principles and boundaries

1. **Coach owns academic decisions.** Software may suggest next steps but cannot silently certify mastery, change targets, or publish learning plans.
2. **Learning Outcome (LO) is the academic unit of progress.** A module is reusable instructional content; an assignment is a student-specific instruction; evidence is what the learner produced; mastery is a coach decision supported by evidence.
3. **Not a linear video LMS.** Student home answers *what should I do next?* Coach home answers *who needs attention and why?*
4. **Multiple ways to achieve one LO.** Module, live coaching, independent task, practice test, revision, or direct evidence may support the same outcome.
5. **Personalization is a decision loop**, not merely choosing modules.
6. **Preserve current Supabase project, RLS, private storage, RPCs, test.e-master.vn assessment boundaries, and submission revision history.** No production migration without approval.
7. **Keep content distinct from presentation and assessment keys.** REE is one specific instructional technique, not a product-wide framework.
8. **Content production must scale:** coaches/content authors can assemble modules from validated activities without editing React for each module.

## 2. Core human-coaching journey

### Onboard / Diagnose
- Admin assigns student and coach, records goal, target date and baseline.
- Coach reviews diagnostic evidence (placement test, interview, sample Speaking/Writing); identifies strengths, gaps and uncertainty.
- Coach chooses priority competencies and LOs; documents rationale and an initial checkpoint.

### Plan
- Coach drafts a learning path/roadmap with priorities and dependencies.
- Coach activates a weekly plan: focus, time budget, tasks, deadlines and next 1:1 session.
- A task may reference a published module, assessment, free-form assignment or live session.

### Execute / Capture
- Student dashboard prioritizes today's next action, due work, feedback and coaching session.
- Student learns/practices and submits evidence: answer, audio, writing, file, self-check, activity result.
- Preserve provenance: task, module version if applicable, activity, attempt, timestamp and file path.

### Review / Adapt
- Coach queue shows submitted work, overdue tasks, revision requests and students lacking recent evidence.
- Coach compares evidence against an LO-specific rubric and marks: **not assessed / emerging / developing / demonstrated / needs recheck** (proposed vocabulary; not a DB enum).
- Coach gives actionable feedback, requests revision or assigns next task.
- Coach may revise the weekly plan, LO priorities and future workload; log decision and rationale.

### Reassess
- Periodic skill-level assessment and target-date check; distinguish practice completion, LO mastery and IELTS band estimate.
- Learner can see what improved, what evidence supports that conclusion and what to do next.

## 3. Domain model and ownership

| Domain concept | Meaning | Current support | Proposed action |
| --- | --- | --- | --- |
| Enrollment | student–coach relationship, baseline/target | `coaching_enrollments` | KEEP |
| Roadmap | high-level sequence | `coaching_roadmaps`, `coaching_roadmap_items` | KEEP; optionally associate LO |
| Weekly plan | time-boxed coach intent | `coaching_weekly_plans` | KEEP |
| Assignment | actionable work | `coaching_tasks` | KEEP; link LO(s) when approved |
| Submission & revisions | learner evidence and feedback history | `coaching_submissions`, revisions | KEEP |
| Coaching session | 1:1 touchpoint | `coaching_sessions` documented | EXPOSE in later slice |
| Content module | reusable versioned instructional asset | `learning_modules.content` | GENERALIZE player/import/publishing |
| Competency framework | skills, subskills, diagnostic indicators | not verified as a canonical coaching domain | DESIGN |
| Learning outcome | measurable capability with assessment criteria | not verified as a canonical coaching domain | DESIGN |
| Student LO status | individualized evidence-backed attainment | not verified | DESIGN |
| Evidence–LO links | trace why mastery is claimed | not verified | DESIGN |
| Coach decision log | why a plan changed | not verified | DESIGN |
| Content authoring/publishing | structured creation and quality gates | partial browser-only preview | DESIGN |

**Critical distinctions:** An LO can be supported by many modules; a module can support several LOs; a task may use no module; a completed module does **not** imply mastery. Avoid hard-coding a one-module-to-one-LO relationship.

### Candidate schema additions — proposal only
- `learning_competencies` (code, skill, hierarchy, level descriptor, framework version)
- `learning_outcomes` (code, observable statement, success criteria, competency references, version)
- `learning_module_outcomes` (module_id, outcome_id, contribution/coverage)
- `coaching_enrollment_outcomes` (enrollment_id, outcome_id, priority, target/checkpoint, status, coach-confirmed date)
- `coaching_task_outcomes` (task_id, outcome_id, intended evidence)
- `coaching_evidence_outcomes` (submission/revision or module attempt reference, outcome_id, rubric observations, reviewed_by)
- `coaching_plan_decisions` (enrollment_id, actor, decision, rationale, source evidence, timestamp)
- Content versions and publication metadata **only after** reviewing existing `learning_modules` content contract and live schema.

These are **conceptual tables**, not permission to create them. Decide whether some can be implemented as structured JSONB or existing `feedback_data` for the pilot, without sacrificing queryability, auditability or RLS.

## 4. Learning content architecture

### Authoring hierarchy
`Program → Competency → Learning Outcome → Content references / learning activities`.

A module is a **versioned collection of activities**, with flexible stage labels and sequence. Stage count is **not** globally fixed. A learning flow is a selectable pedagogical template, not a database-wide invariant.

**Reusable activity families** (initial catalog, not exhaustive):
- video/audio lesson with captions/transcript;
- structured reading / annotated passage;
- multiple choice, multi-select, matching, ordering, fill blank;
- short answer / writing with rubric;
- speaking prompt with recorder and playback;
- guided reflection / self-check;
- downloadable/linked resource;
- timed assessment (separate from practice where appropriate).

Each activity declares `type`, `schema_version`, `id`, `instructions`, `payload`, `response_schema`, `feedback_mode`, `completion_rule`, `estimated_minutes`, `accessibility`. Assessment keys and grading rules stay **server-side/private**; public manifests do not contain correct answers.

### Engine separation
- **Content schema & registry:** parse/validate typed manifests and supported activity versions.
- **Player renderer:** shared visual shell and registered interaction components.
- **Attempt/evidence service:** authenticated persistence, resume, immutable version reference, private media.
- **Assessment/review service:** private answer keys, rubric, coach review, revision rules.
- **Authoring workflow:** draft → validate → preview → editorial/academic QA → publish immutable version → archive/supersede.
- **Assignment integration:** coach selects published content, sets student-specific instructions and required evidence.

REE is **only an example adapter** for a Speaking instructional outcome. The existing `reeManifest`, `validReeActivityResponse` and six fixed stages are pilot-specific. The generic renderer added to PR #7 is **not production ready**: its recording activity is a placeholder and it does not connect to the real persistence/assessment pipeline.

## 5. Workspace contracts

### Student
Home: weekly focus, next task, due date, latest feedback, coaching appointment, progress explained in plain language.
Task: instruction → resource/module (optional) → response/evidence → submit → coach feedback → revision.
Progress: LO-level evidence and coach-confirmed state; no inflated score inferred from clicks or video completion.

### Coach
Home: **attention queue** sorted by actionable reasons (pending review, overdue, revision, stale evidence, upcoming session).
Student workspace: goals and diagnostic, priority LOs, current plan, recent evidence, notes/decisions, sessions.
Review: compare revisions, rubric criteria, timestamped evidence; feedback and explicit next action.
Plan editor: suggest tasks/modules from LO gaps, but coach confirms publication to student.

### Admin / Content team
Enrollment and assignment administration; competency/LO catalog governance; content draft/import; media rights/access checks; rubric/key separation; versioned preview; publication approvals; content usage and QA.

## 6. Current repo fit / gap audit

| Area | Observed evidence | Assessment |
| --- | --- | --- |
| Role routing | `src/App.tsx` with student/teacher/admin guards | KEEP |
| Coaching relationship | `coaching_enrollments`, baseline/target | KEEP |
| Weekly tasks | documented DB and `CoachWorkspace.tsx` | KEEP |
| Roadmap | types and CoachWorkspace UI | KEEP, add LO semantics later |
| Submission history | revision types and service | KEEP |
| Private files/RLS | `docs/DATABASE_V1.md` describes deployed controls | VERIFY with authenticated tests |
| Live sessions | DB contract documented; no route inspected for session workflow | GAP to validate |
| LO/competency model | no canonical LO domain seen in inspected types/docs | DESIGN GAP |
| Mastery decision | REE-specific review in module service | GENERALIZATION GAP |
| Student module player | `ModulePlayer.tsx` imports REE ID, manifest, stages | REFACTOR |
| Admin module list | `AdminModules.tsx` checks REE-specific ID and publication gates | REFACTOR |
| Generic preview | `LearningModulePreview.tsx` is client-side only | PROTOTYPE |
| Content authoring | JSON draft preview, no approved end-to-end publishing flow | GAP |
| Assessment app | documented shared boundary | DO NOT MODIFY |

**Unverified:** actual live database policies and schema drift, successful TypeScript build, authenticated end-to-end flow, SharePoint media playback, real 4-module pedagogical mapping, load/performance, production feature flags. Do not mark these PASS without testing.

## 7. Delivery sequence with exit criteria

### Phase 0 — Freeze and verify (immediate)
- Keep PR #4 and PR #7 as Draft. No merge or production migration.
- Establish authoritative source inventory and actual 4-module LO mapping with content owner.
- Run build/tests and inspect branch diffs; document failures and security risks.
- Output: approved scope, known gaps, architecture decision record.

### Phase 1 — Coaching operating model (pilot)
- Define competency/LO taxonomy for a **small, real set** of LOs across more than one skill.
- Define diagnostic → coach plan → assignment → evidence → review → next action.
- Prototype LO status and decision trail **without** inventing band scores.
- Exit: coach can explain and trace why a student was assigned the next task.

### Phase 2 — Integrated reusable module player
- One generic module contract and registry, with pilot content migrated.
- Complete real recorder, response validation, persistence, version pinning, feedback, offline/error states.
- Demonstrate **two pedagogically different modules** (e.g. Speaking recording and Reading passage), without code changes to player.
- Exit: both run through student task → evidence → coach review with authenticated test accounts.

### Phase 3 — Content production
- Author/import, validate, media access, academic review, preview, publish immutable versions, archive.
- Publish gates are enforced server-side, not only via UI.
- Exit: content author creates a new module from approved components without editing React.

### Phase 4 — Personalization and operations
- Coach attention queue, LO-based suggestions, session notes, re-plan audit, student progress.
- Exit: one coach runs a multiweek pilot and can inspect every feedback/revision decision.

### Phase 5 — Scaling
- Analytics on adherence, LO attainment, coach workload, activity effectiveness; accessibility and reliability; optionally AI assist with coach confirmation.
- Exit: documented QA, monitoring, cost, privacy and operational playbook.

## 8. Acceptance scenarios

1. Student A and B with the same IELTS target receive different LO priorities and weekly plans, each with coach rationale.
2. A student demonstrates an LO through a live task **without completing a module**; coach can still mark it demonstrated.
3. A student finishes all activities but evidence fails rubric; LO remains unmastered and revision is assigned.
4. Two different module types share player infrastructure, while retaining their own activities and evidence requirements.
5. Module v2 is published; an in-progress v1 attempt remains interpretable and does not silently change.
6. Student B and Coach B cannot view Student A's private evidence; unauthorized review fails.
7. Admin can preview draft content without writing student progress or exposing private answer keys.
8. Coach can see submission revision history and explicitly document why next week's plan changed.
9. Missing media and microphone permissions fail visibly with fallback; never pretend a video/recording succeeded.
10. No changes to `test.e-master.vn` assessment behavior or production RLS without separate approval.

## 9. Decisions needed before implementation

- Confirm the actual four pilot modules and their LOs from source documents; do **not** infer them from REE.
- Define LO rubric and coach decision vocabulary; decide whether evidence can come from a coaching session.
- Decide when a module is optional vs required, and what counts as completion.
- Decide which existing database entities can carry LO references safely, and review live RLS before migration.
- Define content ownership: author, academic reviewer, publisher; ensure media licensing and accessible delivery.
- Decide what AI may suggest vs what must remain explicitly coach-approved.

## 10. Immediate next engineering ticket (no code yet)

**Title:** Coaching-domain gap audit and LO-first pilot contract.
**Deliverables:** actual schema/RLS inventory, code dependency map, verified four-module content mapping, LO rubric draft, 2-module contrast test plan, proposed DB migration (review-only), staged refactor plan for PR #4/#7.
**Do not:** merge PRs, add production migrations, declare generic renderer production ready, or turn REE into a universal pedagogy.

## 11. Source-of-truth / precedence
1. Approved product direction and actual source teaching material for pedagogical facts.
2. `docs/DATABASE_V1.md` for deployed baseline database contract (verify against live DB before changes).
3. `docs/VERTICAL_SLICE_01.md` for original implementation scope.
4. Existing code for observed behavior (may be incomplete or wrong).
5. This blueprint for **proposed future direction**, subject to review.

**Change policy:** If source material contradicts an architectural assumption, flag it and request academic confirmation rather than rewriting the learning material.
