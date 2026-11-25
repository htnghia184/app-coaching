# IELTS Micro-module Engine — REE implementation handoff

Scope: GitHub Issue #2, Simple Answer Development (Part 1), source file dated Nov 12, 2026 by Josh. This is a code and schema **proposal** on a feature branch. The shared production Supabase project was not changed.

## Source to experience

Source: [Student Learning Package Simple Answer Development (Part 1)](https://simpclub.sharepoint.com/sites/E-MasterLanguagesCenter-Micro-ModuleIELTSCoachingProject/_layouts/15/Doc.aspx?sourcedoc=%7BF823F0D3-9D72-4FB2-9DD0-035B09D5919F%7D), SharePoint modified 2026-11-23T01:37:43Z. The original Word package remains authoritative. Public manifest: `src/modules/ree.ts`, content version 1, module UUID `eaab8a50-243b-4ea6-a8d4-59c58120ef01`. Wording and ordering of prompts, options, examples, checklist and rubric were transcribed from the connector's extracted text. A human content reviewer must compare against the rendered Word file before publication.

| Source section | Learning experience | Source trace |
| --- | --- | --- |
| Discover (~1') | One diagnostic recording, playback and question to revisit in Verify | `discoverPrompt`, prompt ID `discover` |
| Learn (~6') | Layered REE diagram, response patterns, two before/after examples and transcripts. Missing source audio is called out in the screen. No guessed video. | `learn`, `missingAssets` |
| Practice (~6') | All six MCQs with option **and** Explain/Example choice, then a four-set matching exercise. Each whole exercise must be submitted before server-returned keys/explanations appear. Retries append rows. | `practice.mcq`, `practice.matching`; private activity IDs `ree-mcq`, `ree-matching` |
| Apply (~4') | Three separate Speaking prompts, each recorded, played back and saved independently. | `apply.prompts` |
| Reflect (~2') | Playback of Apply recordings and five saved checkboxes. The final item remains self-perception only. | `reflect.items` |
| Verify (~2') | Repeats Discover question; separate final recording; submits through existing `coaching_submissions` and review history. | `verify`, rubric |

UI headings, progress labels, status messages, buttons and the layered card presentation are authored UX copy and layout. They do not replace source exercise or rubric text. Video assets can be attached only to Learn; the manifest validator rejects any video in another stage.

## Persistence and review contract

- `coaching_tasks.module_id` associates the assigned task with an immutable `learning_modules` row. Coach assignment continues through the existing weekly plan and enrollment. Student route `/student/modules/:taskId` is guarded by the existing student role route. The coach's module picker only offers published REE metadata for this first release.
- Proposed SQL is in `docs/proposed/ielts_module_engine.sql`. It adds append-only practice attempts and recording metadata, plus version-pinned module attempts with stage data, resume stage, six completion flags, completion time, review status and mastery time. The student's ordinary submission is still canonical for Verify; the new coach wrapper calls `review_coaching_submission` to retain existing feedback/revision history.
- New browser service calls use the logged-in session. New tables have RLS and no direct browser write grants; RPCs validate learner identity, assigned task and stage. The private key table is in `coaching_private` and has no browser grants. Keys/solution explanations are revealed only in the response and stored result of a submitted activity attempt.
- The REE coach wrapper requires four 0–2 rubric scores and feedback. Mastery requires at least 6/8, no zero and a Verify duration of 20–30 seconds, unless the coach requests revision. Duration is browser/media metadata and **must be checked by the coach against playback**; it is not a trusted automated audio inspection.
- Existing `coaching-submissions` Storage paths and signed URLs are reused. The SQL proposal adds restrictive Storage policies to preserve audio once referenced by a module attempt. Review these policies with existing Storage behavior before application.
- Attempts pin `module_id` and `content_version`. Published manifest data is made immutable by a proposed trigger; future versions require a new module row and a retained client manifest. The player refuses an unknown version rather than displaying changed content against old attempts.

## Private answer import and publication gate

The GitHub repository is **public**. Answer keys and source explanations must not be committed to this repository, frontend code, public assets, PR text or screenshots. The proposed migration intentionally creates the private key table without inserting either REE key set. An authorized operator must prepare an uncommitted, source-reviewed SQL import for `ree-mcq` and `ree-matching`, with:

- `module_id` = `eaab8a50-243b-4ea6-a8d4-59c58120ef01`.
- `answer` JSON for MCQ keys `1`–`6`, each containing `choice` and `stage`; matching keys `1`–`4`, each containing `explain` and `example`.
- `explanations` JSON mapping those same item IDs to the full original explanation text.

Do this only on an approved test environment first. Verify a student can retrieve feedback after submission, cannot query the private table or fetch keys before submission, and cannot read another learner's attempt. The proposed publish trigger rejects publication while either private key set is absent. Publication also requires both missing Learn audio examples, content review and the P0 role security issue to be addressed or explicitly risk accepted by the owner. Three MP4s `m02/m03/m04` remain unmapped and are not attached to REE.

## QA still required

- Apply the proposal in a verified isolated test project after review; inspect RLS, RPC grants, triggers, Storage policies and rollback. No production DB migration was applied by this branch.
- Test student/coach/admin/anonymous access, answer leakage before/after submission, stage resume, retries and source-version history. Test multiple recordings, micro permissions, browser MIME variants, interrupted uploads and signed URL playback on mobile. Verify the first Verify submission and revision-request/resubmission path.
- Run regression against existing text/audio/file/checkoff coaching tasks and offline PWA shell. Existing E2E scripts can write data and must only run with approved disposable accounts and environment.
- Capture screenshots from an authenticated test session after backend and content dependencies are available. A build alone is not evidence of an end-to-end coaching workflow.
