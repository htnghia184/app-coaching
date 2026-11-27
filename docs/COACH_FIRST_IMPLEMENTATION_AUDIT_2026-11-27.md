# Coach-first implementation audit and vertical-slice plan

**Review draft, 2026-11-27.** Base: `chatgpt/coach-first-handoff-20261127` at `4c4bd2edaa9dca5717074dae67f9054f0704ee4c` (PR #8). This is source inspection, not runtime, deployment, or live database verification. The four-module subsystem contract remains [FOUR_MODULE_CONTENT_ENGINE_SPEC_2026-11-27.md](FOUR_MODULE_CONTENT_ENGINE_SPEC_2026-11-27.md); this plan neither replaces nor relaxes its source parity, private key, media, versioning, and module-specific Verify rules.

## Finding: the coaching spine is reusable

| Capability | Code evidence | Reuse and boundary |
| --- | --- | --- |
| Auth and roles | `src/App.tsx`, `src/auth/AuthProvider.tsx`, `src/components/RequireRole.tsx` route student, teacher, admin | Keep; backend authorization must be checked separately. |
| Enrollment and goal | `AdminEnrollment.tsx`; `coachingService.ts` `createEnrollment`; `types.ts` baseline/target/coach | Keep; diagnostic evidence and coach rationale are not first-class records. |
| Coach attention | `CoachDashboard.tsx` batches enrollment/plan/task/submission queries and counts pending reviews, overdue required tasks, revisions | Keep; no LO gap or stale evidence signal yet. |
| Roadmap and weekly plan | `CoachWorkspace.tsx` roadmap and plan composers; service `createRoadmap*`, `createWeeklyPlan` | Keep existing editing flow. Roadmap item is title/description/status, with optional module ID; no outcome link. |
| Assignment | `CoachWorkspace.tsx` `TaskComposer`; `coaching_tasks` can reference a module but also supports text/audio/file/checkoff | Keep tasks as the unit of personalized action, whether or not a module is involved. Current lesson picker filters to REE ID. |
| Learner next action | `StudentDashboard.tsx` prioritizes revision, required work, then waiting/reviewed; routes module tasks to player | Keep priority logic; display coach's reason and intended outcome when available. Its required-task progress treats `submission.status=reviewed` as done, which is not LO mastery. |
| Evidence and review | `StudentTaskDetail.tsx` records text/audio/file/checkoff, saves drafts, submits and shows revisions; `coachingService.ts` uses `update_own_coaching_submission` and `review_coaching_submission` RPCs, private upload and signed URL | Keep evidence path and review history. A reviewed submission is not necessarily demonstrated skill. |
| Module subsystem | `ModulePlayer.tsx`, `ree.ts`, `moduleService.ts`, `CoachModuleReview.tsx` support REE-specific attempts/recordings/review; `learningSchema.ts` and `LearningModulePreview.tsx` are a shallow generic presentation preview | Integrate through an assigned task and evidence references. Do not put all coaching through the module player. Proposed module SQL is unapplied; do not assume its RPCs exist in production. |

The product has a recognizable coach → plan → task → evidence → review loop in source. The gap is a durable link from *why this task was assigned* to *what the evidence demonstrates* and *what the coach decided next*. `types.ts` has no canonical Learning Outcome (LO), learner LO assessment, or evidence-to-LO link. `learningSchema.ts` has a single outcome string, while REE has its own mastery policy; neither creates a learner-wide mastery record. No authenticated end-to-end behavior was verified in this audit.

## Minimal LO contract for pilot review

Start with a **small versioned IELTS LO catalog**, curated with the academic owner from actual source packages and diagnostic practice. Each LO has stable ID, version, skill, observable statement, success criteria/rubric reference, and active/retired state. Do not infer IELTS band scores from LO states. Keep competency hierarchy optional until more than a few outcomes require it.

For each enrolled learner, coach selects priority LO IDs, records baseline observation and uncertainty, target checkpoint, and rationale. A task may target zero or more LOs; a module may teach zero or more LOs. Evidence may come from a task submission/revision, module attempt, assessment, or a documented coaching session. The evidence record needs type, immutable source/version reference, learner, time, and private media reference where applicable. The coach makes an explicit LO assessment with status **not assessed / emerging / developing / demonstrated / needs recheck**, criterion observations, evidence references, rationale, reviewer, and timestamp. Treat this vocabulary as proposed until academic review; keep prior decisions when reassessing. `demonstrated` is a coach judgment supported by evidence, never inferred from `reviewed`, clicks, activity completion, or automated practice scoring.

The pilot should add the smallest durable, queryable LO links and decision history after a **read-only live schema/RLS/RPC audit**. Do not put audit-critical mastery state into an unstructured frontend-only field. Existing `feedback_data` may carry rubric detail on a submission, but cannot alone represent evidence from several tasks or a session. A schema/RLS proposal requires isolated validation and separate approval before any production application.

## Personalized workflow

1. Admin enrolls learner and coach with goal, baseline, target and date (existing).
2. Coach examines diagnostic evidence, selects 1–3 priority LOs, records rationale and a checkpoint; uncertainty remains visible.
3. Coach drafts/activates roadmap and weekly plan (existing), assigns tasks with intended LO and evidence requirement. A module is an optional resource; a direct audio/writing task is valid.
4. Learner sees next task and purpose, submits evidence or revises (existing submission path). Module activity completion remains local to that module.
5. Coach attention queue identifies reviews and overdue work (existing), then presents relevant LO criteria and earlier evidence. Coach reviews submission and separately records an LO assessment and next action.
6. Coach adapts the next weekly plan with a short reason linked to evidence. Learner sees feedback, progress claim, supporting evidence, and next step. A periodic recheck can change an earlier LO assessment without erasing it.

## Prioritized vertical slices and acceptance

| Priority / slice | Smallest implementation | Acceptance gate |
| --- | --- | --- |
| P0: baseline and security gate | Recheck live shared schema, role/RLS/RPC/storage grants read-only; verify current PRs and existing 1:1 flow with isolated accounts. Resolve the previously recorded `profiles.role`/signup metadata privilege issue through separately reviewed remediation before learner rollout. | Evidence log distinguishes source, test, preview, live DB; student, assigned coach, other coach, admin and anonymous access tested in isolated environment; no production write. Existing enrollment → task → review → revision still works. |
| P1: one LO, two evidence paths | Academic owner approves one observable IELTS LO and rubric. Coach links it to a learner and assigns either an ordinary audio/text task or REE module task; record rationale and evidence refs, then explicit coach assessment. Keep current UI/service structure. | Two learners with the same goal can receive different priorities; learner can demonstrate LO from a non-module submission; completed module can remain unmastered; every decision shows reviewer, evidence and time. |
| P1: feedback-driven next week | Add LO context and evidence history to existing coach workspace; record why coach changes next task/plan; show learner the reason and next action. | Coach can trace task → evidence → feedback → LO decision → next task; revision preserves older evidence and decision; current dashboard prioritization remains intact. |
| P2: generic module integration | Implement the four-module spec's strict content/response contract and engine as a task resource, beginning with one source-verified module. Reuse assignment, private evidence, coach review and LO assessment boundaries. | Player needs no module-ID React branch for differing activity shapes; versions remain interpretable; M02 reuses six Apply recordings while M04 Discover has no recorder; open answers are not falsely exact-graded; module completion never sets LO mastery. All source parity and publication gates in subsystem spec pass. |
| P2: four-package validation and publishing | Complete four source audits, media registry, private key/rubric separation, preview and academic approval before immutable publish. | Each source question, table, media and rubric maps to approved manifest; missing required assets block publish; no keys/private IDs in public bundle; preview writes no student progress. |
| P3: coaching operations | Add session evidence/notes, stale-evidence attention and pilot workload measures only after the first full loop works. | Coach can reassess from session evidence without a module; learner sees history, not an inflated completion score; coach workload can be measured for the 10-paying-learner commercial gate without claiming it has been reached. |

## Decisions and open verification

- Academic owner: confirm pilot LO wording, criteria, status vocabulary, source-to-LO mapping, and whether session evidence is sufficient for demonstration.
- Engineering/DB owner: inspect live schema and RLS before selecting tables/RPCs; compare PR #8 with other draft module proposals. Do not execute proposed SQL or use data-writing E2E against shared production.
- Content owner: verify SharePoint rendered layouts and audio/video rights, mappings and source revisions. Text extraction alone is insufficient for publication.
- Product owner: confirm release order and learner/coach pilot capacity. Existing counts in `IMPLEMENTATION_STATUS.md` are dated 2026-11-25 and do not establish paying learners.

**Handoff:** Trae/local developer owns app implementation after product/academic review of this plan. HQ/ChatGPT coordinates review. No application code, database, deployment or production data change is authorized by this document.
