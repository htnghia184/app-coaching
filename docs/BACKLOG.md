# IELTS Coaching — Shared Backlog
Updated: 2026-11-25. Statuses are evidence-based, not estimates of completion.

## P0 — before real learner rollout
- [ ] Review and plan remediation of profiles.role update privilege and signup metadata role injection. Deferred by owner; risk remains open. No unauthorized production change.
- [ ] Confirm exact SharePoint asset access and permissions for implementation and learner playback.
- [ ] Inspect current module DB schema, RLS and coaching RPC fit; prepare reviewed migration proposal only if needed.

## P1 — first module end to end
- [ ] Implement versioned module manifest + validator; source content kept verbatim.
- [ ] Build mobile-friendly six-stage ModulePlayer and resume/progress.
- [ ] Implement MCQ, matching, fill blank, text, audio and reflection/checklist interactions as required by source.
- [ ] Import **Simple Answer Development (Part 1)** exactly, including question order, explanations and rubric.
- [ ] Integrate secure audio submissions and coach review, revisions, attempts and mastery.
- [ ] Test student/coach access, audio permissions, retries, history and no regressions.
- [ ] Run `npm run typecheck` and `npm run build` and report real outcomes.
- [ ] Draft PR for review; do not merge/deploy without authorization.
Tracking: https://github.com/htnghia184/app-coaching/issues/2

## P2 — remaining reviewed content
- [ ] Import Mở đầu tự nhiên (Part 1), preserving per-question verification and targeted retry.
- [ ] Import Self-Questioning (Part 1).
- [ ] Import Example (Part 1).
- [ ] Verify motion-graphic video/audio mapping and transcript availability.
- [ ] QA prerequisite relationships and source-specific scoring.
- [ ] Compare delivered modules against the earlier 12-module target; do not assume completed.

## Documentation / operational
- [x] GitHub issue for implementation scope (#2).
- [x] Codebase map and implementation status drafted on docs branch.
- [x] Shared master context, decision log, backlog, module engine spec, content source map drafted on docs branch.
- [ ] Reconcile local project originals when accessible.
- [ ] Review and merge docs PR.
- [ ] Establish content change process: SharePoint source version → mapping/version update → review → release.

## Business
- [ ] Verify actual number of paying IELTS pilot learners against the 10-learner gate.
- [ ] Confirm pilot rollout and coach workload after first full module works.
