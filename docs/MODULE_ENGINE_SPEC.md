# IELTS Micro-module Engine — Implementation Contract (Draft)
Updated: 2026-11-25. This is a technical interpretation for implementation, **not** a rewrite of teaching content.
Tracking: https://github.com/htnghia184/app-coaching/issues/2

## Source of truth
Read docs/CONTENT_SOURCE_MAP.md. Each Word package is authoritative for actual wording, prompts, answer options, correct answers, explanations, time estimates, LO and rubric. If a source section is ambiguous or content is absent, stop that content import and flag it; never generate a substitute.

## Goals
Reusable six-stage player embedded in existing coach-centered app. Support mobile study, answer attempts, recordings, reflection, coach verification, feedback, revision and mastery. Preserve existing student/teacher/admin routing and coaching flows.

## Suggested versioned manifest (proposal; not a claim about live DB)
- `module_id`, `content_version`, `title`, `skill`, `level`, `estimated_minutes`, `learning_outcome`, `prerequisite_ids`, `source_url`, `source_revision`.
- Ordered `steps` with `kind` Discover/Learn/Practice/Apply/Reflect/Verify, instructions and ordered content blocks/interactions.
- Interaction IDs stable within version; `type` and type-specific payloads; answers/explanations restricted until learner submission.
- Asset references include verified type, source location, duration, captions/transcript and access strategy.
- Verification config captures rubric criterion IDs and anchors, pass rules, duration rules, per-question vs aggregate decision and coach signoff.

## Player behavior
1. Discover: store baseline audio or source-specific selection; allow comparison later.
2. Learn: present source lesson text and verified audio/video with transcript when supplied.
3. Practice: MCQ, matching, fill blanks, text and other source-defined exercises; show keys after attempt, preserve retries.
4. Apply: separate recordings/responses for each source prompt; permit playback, redo and reliable upload retry.
5. Reflect: playback and source checklists, saved per attempt.
6. Verify: route evidence to coach, show exact source rubric, save coach decision and feedback; targeted revision when source requires.

## Source-specific scoring
- Simple Answer Development (REE): four 0–2 criteria, pass 6/8 with no zero and source 20–30s condition; coach verification.
- Self-Questioning: four 0–2 criteria, pass 6/8 with no zero and source 20–30s condition.
- Example: four 0–2 criteria (Who/What/When/relevance), pass 6/8 with no zero and source 20–30s condition.
- Mở đầu tự nhiên: per-question verification; six Apply recordings, each checked for correct opener, grammar and non-repetition; only failed items need resubmission. Do not force aggregate 6/8.
These are internal module criteria, **not official IELTS band scoring**. Always check full Word source before encoding thresholds.

## Data and security
- Reuse authenticated coaching enrollment/task/submission/revision path when compatible; do not create parallel review state without analysis.
- Keep attempts append-only or history-preserving; pin each attempt to exact content version.
- Distinguish `completed` (all required learner steps) from `mastered` (coach-verified success).
- Use private storage and expiring signed URLs for learner recordings; honor RLS and role checks.
- Never expose answers before attempts or sensitive media through public URLs.
- The current DB has a `learning_modules` table but its suitability for all state/history needs verification; do not assume a migration is required or authorized.

## Build slices and acceptance
1. Read existing code, schemas and docs; propose integration/data changes.
2. Implement manifest schema and one exact REE module import.
3. Student player + interaction components and progress.
4. Coach verify, feedback, revision, mastery.
5. Safe tests, mobile QA, draft PR.
Acceptance: exact content, six-step flow, correct answer reveal, recorded submissions, coach review and targeted revision, history retained, no regression, typecheck/build passing. Report untested behaviors honestly.

## Non-goals
- Rewriting learning packages.
- Auto-scoring IELTS bands or replacing coach.
- Populating fabricated exercises for unused interaction types.
- Production migrations, security-policy changes, merging or deployment without approval.
