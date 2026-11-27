# Decision Log — IELTS Coaching
Updated: 2026-11-27. Entries below are known decisions from reviewed project context and prior handoff; date is recorded only where supported. This file does not replace unavailable local decision-log originals.

| Date / status | Decision | Consequence |
|---|---|---|
| 2026-11-17 handoff | Pilot focuses on IELTS only | Do not broaden pilot UI just because historical schema supports TOEIC/VSTEP |
| 2026-11-17 handoff | 10 paying learners is commercial validation gate | Do not claim goal achieved without paid enrollment evidence |
| 2026-11-09 discussion | 12 micro-modules targeted within two weeks | Milestone target, not proof of delivered content |
| Confirmed project direction | Coach-centered blended coaching, not video-only LMS | Retain roadmap, weekly plan, submissions and coach review |
| Confirmed content workflow | SharePoint is authoritative for Nhựt's learning packages | GitHub references source; no silent pedagogical changes |
| 2026-11-25 | Implement first complete module with REE / Simple Answer Development | Validate end-to-end before bulk importing other modules |
| 2026-11-25 | Preserve six-stage flow Discover/Learn/Practice/Apply/Reflect/Verify | Player should model each step explicitly |
| 2026-11-25 | Module-specific Verify rules and coach decision | Completion is not mastery; per-item review supported for Natural Opening |
| 2026-11-25 | GitHub as shared handoff for ChatGPT and Codex | Keep accepted specs/decisions/issues in repo, not all chat history |
| 2026-11-25 | No production modifications without explicit approval | Draft PR, schema proposal, safe tests first |
| 2026-11-25 | Previously identified auth/role security remediation deferred | Risk remains open; not permission to weaken controls |

## 2026-11-27 clarification and evidence
| Status | Decision / evidence | Consequence |
|---|---|---|
| Owner reaffirmed direction | Human-led affordable coaching; English Gym, coach at center | LO and coach decision loop govern product; module engine is a subsystem |
| Owner reaffirmed direction | IELTS local pilot, 10 paying learners gate distinct from 12-module output | Manual operations acceptable; no SaaS/multi-track expansion now |
| Proposed architecture, review required | Flexible module stages and eight activity families from four source packages | Six-stage template retained for current packages only; no global REE rule |
| Proposed priority, owner requested handoff | P0 minimal LO-first coaching loop + generic player integration | Do not build advanced LMS/editor before validating service |
| Owner-confirmed media | M02–M04 corrected private YouTube mapping; embed worked in admin demo | Do not expose IDs in public repo; academic/media parity still unverified |
| Reported security update | PR #5 role hotfix applied 25 Nov, regression results documented | Supersedes earlier deferral for this specific fix; UI E2E still unverified |

## Pending, not decided
- Verify actual video contents against each module and locate remaining sample audio; owner-provided YouTube mapping is known privately.
- Whether each content asset is accessible to Codex and via which supported workflow.
- Exact persistence schema for module progress/attempts/mastery after checking live DB and existing RPCs.
- Release date and pilot learners for the new player.
- Reconciliation with the unavailable local decision-log original.

## How to update
Append dated decisions with rationale, owner and link to issue/PR; never rewrite historical decisions as if they were always true.
