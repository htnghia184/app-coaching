# IELTS Coaching — Shared Backlog
Updated: 2026-11-27. Proposed execution order, not evidence of completed work.
North Star: affordable human-led coaching; 10 paying learners commercial gate, separate 12-module production target. Read MASTER_CONTEXT and DECISION_LOG first.

## P0 — smallest complete personalized coaching loop
- [ ] Audit actual existing enrollment, roadmap, weekly tasks, submissions, revisions and coach review; reuse before proposing new entities.
- [ ] Define minimal competency/LO taxonomy and observable criteria from four real modules; allow non-module evidence and multiple LO links. Coach-confirmed priority, status and decision rationale; no invented IELTS band.
- [ ] Prototype diagnosis → LO prescription → weekly task → evidence → coach review → revision → next plan. Demonstrate two learners with same target but distinct prescriptions.
- [ ] Strict content schema and generic activity registry; four draft previews preserving original sources, flexible stages, distinct M02 per-item review and M04 Discover choice.
- [ ] Verify current security and existing RPC/schema fit in isolated environment; role hotfix reported applied in PR #5, production UI E2E unverified.
- [ ] Integrate version-pinned attempts, recording/evidence, coach feedback and targeted retry into existing assignment/submission flow; no unapproved migration.
- [ ] Test mobile/desktop, private evidence isolation, failure/reload, revision history, non-module mastery and coach plan adaptation.
- [ ] Verify private media registry, audio availability, academic source parity and reviewer approval.
- [ ] Run typecheck/build/tests; separate draft PR, no production changes without explicit approval.

## P1 — minimum operational content workflow and pilot
- [ ] Private package import/validation/preview/approval/versioned publish; manual authoring acceptable.
- [ ] Pilot with real learners after release approval; measure LO evidence, adherence, coach time and delivery cost; verify paid learner count.
- [ ] Expand library toward 12 modules only after standard validated; confirm actual delivered count.
- [ ] Establish SharePoint source revision → QA → release process.

## P2 — deferred
Advanced visual authoring, automatic adaptive learning, AI auto-grading, payment automation, heavy analytics, multi-tenant SaaS, additional exam tracks. Revisit when pilot evidence warrants.

## Documentation and boundaries
- [x] Four source texts re-opened and proposed generic engine spec committed on demo branch.
- [x] Owner tested YouTube embedding in admin demo (not full module release).
- [ ] Reconcile unavailable local originals and confirm product owner approval of proposed technical details.
- Keep PR #4/#7 draft; do not merge or deploy production. Existing assessment app remains unchanged.
