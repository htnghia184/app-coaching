# IELTS Micro-module Engine — REE implementation handoff

Scope: GitHub Issue #2, Simple Answer Development (Part 1), source file dated Nov 12, 2026 by Josh. This is a code and schema **proposal** on a feature branch. The shared production Supabase project was not changed.

## Source to experience

Source: [Student Learning Package Simple Answer Development (Part 1)](https://simpclub.sharepoint.com/sites/E-MasterLanguagesCenter-Micro-ModuleIELTSCoachingProject/_layouts/15/Doc.aspx?sourcedoc=%7BF823F0D3-9D72-4FB2-9DD0-035B09D5919F%7D), SharePoint modified 2026-11-23T01:37:43Z. The original Word package remains authoritative. Public manifest: `src/modules/ree.ts`, content version 1, module UUID `eaab8a50-243b-4ea6-a8d4-59c58120ef01`. Wording and ordering of prompts, options, examples, checklist and rubric were transcribed from the connector's extracted text. A human content reviewer must compare against the rendered Word file before publication.

| Source section | Learning experience | Source trace |
| --- | --- | --- |
| Discover (~1') | One diagnostic recording, playback and question to revisit in Verify | `discoverPrompt`, prompt ID `discover` |
| Learn (~6') | Layered REE diagram, response patterns, two before/after examples and transcripts. Both example audio tracks are embedded in the Learn lesson video per product-owner clarification (2026-11-25). The video is not yet mapped or verified; no standalone audio uploads are required. | `learn`, `missingAssets` |
| Practice (~6') | All six MCQs with option **and** Explain/Example choice, then a four-set matching exercise. Each whole exercise must be submitted before server-returned keys/explanations appear. Retries append rows. | `practice.mcq`, `practice.matching`; private activity IDs `ree-mcq`, `ree-matching` |
| Apply (~4') | Three separate Speaking prompts, each recorded, played back and saved independently. | `apply.prompts` |
| Reflect (~2') | Playback of Apply recordings and five saved checkboxes. The final item remains self-perception only. | `reflect.items` |
| Verify (~2') | Repeats Discover question; separate final recording; submits through existing `coaching_submissions` and review history. | `verify`, rubric |

UI headings, progress labels, status messages, buttons and the layered card presentation are authored UX copy and layout. They do not replace source exercise or rubric text. Video assets can be attached only to Learn; the manifest validator rejects any video in another stage.

## Persistence and review contract

- `coaching_tasks.module_id` associates the assigned task with an immutable `learning_modules` row. Coach assignment continues through the existing weekly plan and enrollment. Student route `/student/modules/:taskId` is guarded by the existing student role route. The coach's module picker only offers published REE metadata for this first release.
- Proposed SQL is in `docs/proposed/ielts_module_engine.sql`. It adds append-only practice attempts and recording metadata, plus version-pinned module attempts with stage data, resume stage, six completion flags, completion time, review status and mastery time. A revision attempt pins the original module version and declares its inherited evidence attempt. The student's ordinary submission is still canonical for Verify; the new coach wrapper calls `review_coaching_submission` to retain existing feedback/revision history.
- New browser service calls use the logged-in session. New tables have RLS and no direct browser write grants; RPCs validate learner identity, assigned task, stage order, response structure and option IDs. Practice completion requires both valid persisted activities. Learn records an acknowledgment and Reflect records a self-review, neither of which grants mastery. The private key table is in `coaching_private`, keyed by module ID, content version and activity ID, and has no browser grants. Published keys cannot be edited. Keys/solution explanations are revealed only in the response and stored result of a submitted activity attempt.
- The REE coach wrapper requires four 0–2 rubric scores, feedback and explicit confirmation that the coach listened to the current attempt's Verify audio and checked duration. Mastery requires at least 6/8, no zero and a Verify duration of 20–30 seconds, unless the coach requests revision. Duration is browser/media metadata and **must be checked by the coach against playback**; it is not a trusted automated audio inspection. The review screen separates current-attempt evidence from labeled inherited Discover/Apply evidence; it never inherits Verify.
- Existing `coaching-submissions` Storage bucket and signed URLs are reused. Module audio paths include the attempt ID under the existing student/task folders, which matches the live Storage policies' first-two-folder checks observed read-only on 2026-11-25. The recording RPC requires that attempt folder and an audio MIME type. The SQL proposal adds restrictive Storage policies to preserve audio once referenced by a module attempt. Their UPDATE/DELETE behavior still needs execution in isolation before application.
- Attempts pin `module_id` and `content_version`. Published manifest data is made immutable by a proposed trigger; future versions require a new module row and a retained client manifest. The player refuses an unknown version rather than displaying changed content against old attempts.

## Private answer import and publication gate

The GitHub repository is **public**. Answer keys and source explanations must not be committed to this repository, frontend code, public assets, PR text or screenshots. The proposed migration intentionally creates the private key table without inserting either REE key set. An authorized operator must prepare an uncommitted, source-reviewed SQL import for `ree-mcq` and `ree-matching`, with:

- `module_id` = `eaab8a50-243b-4ea6-a8d4-59c58120ef01`.
- `content_version` = `1`. Each future version needs separate private keys; the attempted version selects the scoring key.
- `answer` JSON for MCQ keys `1`–`6`, each containing `choice` and `stage`; matching keys `1`–`4`, each containing `explain` and `example`.
- `explanations` JSON mapping those same item IDs to the full original explanation text.

Do this only on an approved test environment first. Verify a student can retrieve feedback after submission, cannot query the private table or fetch keys before submission, and cannot read another learner's attempt. The proposed publish trigger rejects publication while either private key set is absent. Publication requires a verified Learn video containing both example audios (music and literature), content review, and applicable security/role checks. Do not require separate Learn audio files. The production profiles.role hotfix was completed separately; verify release-environment role tests before publication. Three MP4s `m02/m03/m04` remain unmapped and are not attached to REE.

## QA still required

- Apply the proposal in a verified isolated test project after review; inspect RLS, RPC grants, triggers, Storage policies and rollback. No production DB migration was applied by this branch.
- The 2026-11-25 review response could not run SQL in isolation: Docker is installed but its Linux daemon is unavailable, WSL access is denied, no local PostgreSQL binaries are installed, and the connected Supabase project has no development branches. The SQL text has only static regression checks; syntax, RLS and Storage behavior remain unverified.
- Test student/coach/admin/anonymous access, answer leakage before/after submission, stage resume, retries and source-version history. Test multiple recordings, micro permissions, browser MIME variants, interrupted uploads and signed URL playback on mobile. Verify the first Verify submission and revision-request/resubmission path.
- Run regression against existing text/audio/file/checkoff coaching tasks and offline PWA shell. Existing E2E scripts can write data and must only run with approved disposable accounts and environment.
- Capture screenshots from an authenticated test session after backend and content dependencies are available. A build alone is not evidence of an end-to-end coaching workflow.

## Planned module authoring and import workflow (product decision, 2026-11-25)

**Status: PLANNED, NOT IMPLEMENTED.** Admin currently supports read-only module inventory and six-stage REE preview. The REE manifest and player are still hardcoded to a known module/version. Do not describe the following workflow as shipped.

**Chosen MVP: hybrid AI-assisted content preparation + Admin import, not per-module hardcoding and not a full drag-and-drop CMS.**

1. Content owner prepares a standardized Word document or structured JSON using the common six-stage template, with module metadata (title, level, skill, learning outcome, prerequisites, duration), stage content, activities, media references, and source trace.
2. AI or an authorized conversion workflow transforms source material into a **validated, versioned module JSON draft**. Preserve the source wording and question IDs for human review; never treat AI output as automatically approved.
3. Admin imports JSON through the authenticated Admin interface. The server validates schema, activity types, version and authorization, then creates a **Draft** in Supabase. Invalid imports produce actionable field-level errors. Do not commit generated module content to frontend code for each new lesson.
4. Admin previews all six stages **using the same renderer the student will use**, edits Draft metadata/content and associates verified video/media. For the REE example, both sample audios are embedded in the Learn video; no separate audio upload is required.
5. Private correct answers and explanations are imported **through a separate server-authorized secure path** into the version-pinned private key store. Never include them in public module JSON, client bundle, repository, logs, screenshots, or broadly readable tables.
6. A trusted **server-side publication gate** verifies required media and source/content approval, private keys and activity completeness, access/security checks, and version integrity. An Admin can Publish only when all checks pass. UI checks alone must not bypass this gate.
7. Coach assigns only Published modules. Student player dynamically renders the selected version from the database; progress, recordings, attempts, grading and coach review remain pinned to that immutable version. Changes after publication require a **new Draft version**, leaving existing learners' history intact.

**Engineering priorities:** (a) define the reusable data-driven manifest/schema and dynamic player boundary; (b) implement Admin JSON import, Draft edit and true student-view preview; (c) implement secure private key import and server-side publish validation; (d) add version cloning and verified media selection. Do not build a complex visual drag-and-drop editor for the initial 12-module pilot. A richer visual editor, question bank and bulk asset management can follow once module volume justifies them.

**Release discipline:** Develop/test against Supabase Local or an explicitly approved isolated environment. Do not apply production migrations, publish incomplete modules, merge this draft PR, or deploy without separate approval. Browser/mobile E2E remains required.

## Media inventory check (2026-11-25)

The SharePoint project site `/sites/E-MasterLanguagesCenter-Micro-ModuleIELTSCoachingProject` has a `Motion graphic` folder with these existing video files:
- `ielts-s-p1-m02 with audio.mp4` (18,386,880 bytes)
- `ielts-s-p1-m03_2026-11-14_20-44-21 with audio.mp4` (17,749,570 bytes)
- `ielts-s-p1-m04_v1 with audio.mp4` (24,022,742 bytes)

These are real existing SharePoint assets, but **none has been confirmed as the Learn video for REE / Simple Answer Development (Part 1)**. Their `m02/m03/m04` identifiers alone are insufficient to map them to the REE module; a source mapping or content verification is required. The available connector listing confirms filenames and file metadata, not the audiovisual contents. Do not mark them verified or bypass the Learn video publication gate merely because files exist. Once the correct file is identified, use an authenticated/authorized playback URL or a supported private media delivery path (not an untested SharePoint browser page URL) and verify student access on mobile.

## Media policy clarification (2026-11-25; owner approved)

Learn does **not** require a video by default. Choose media (video, audio, text, interactive diagrams, or none) based on each module's learning objectives and source. Do not hardcode a global video publication gate. For REE, the owner says the two sample audios are included in an existing Learn video, but the authoritative Word package does not provide a video ID or URL. The REE UUID `eaab8a50-243b-4ea6-a8d4-59c58120ef01` is an app content identifier, not evidence that any of the SharePoint filenames `m02/m03/m04` matches. The three files predate the current Word document and remain unmapped. REE may render source text and transcripts without treating the absent video mapping as an automatic publish blocker; editorial QA must still confirm required instructional content and media where explicitly specified. Once mapped, attach and validate video access separately. Do not claim an existing file is linked until verified.

Correction to earlier notes: any statement that **all** Learn stages require video, or that REE must upload separate audio, is superseded by this decision. Publication checks should derive required assets from module-specific content requirements, not media-type defaults.

## Owner-confirmed REE media mapping (2026-11-25)

The product owner explicitly identifies `ielts-s-p1-m02 with audio.mp4` as the Learn video for REE / Simple Answer Development (Part 1), module UUID `eaab8a50-243b-4ea6-a8d4-59c58120ef01`. Source: SharePoint `Motion graphic` folder, item `01DMRTO52LYB7KY6EG7BGLKVPPBWNY5QS7`. This overrides the earlier unmapped status **for m02 only**. The manifest now records the source video with `verified: false` until playback, permissions and embedded example audio are QA-checked. The student Learn screen offers an explicit SharePoint link (may require login); this is **not yet an in-app video player or guaranteed student access**. Do not use the SharePoint browser URL as a direct HTML5 video source without testing. M03 and M04 remain unassigned. No universal Learn-video requirement is introduced.

## Approved media hosting decision: YouTube-first pilot (2026-11-25)

**APPROVED by product owner.** For the initial 12-module IELTS Coaching pilot, use **YouTube** as the default host for instructional video when a module actually needs video. Use **Unlisted** for lesson-specific video and optionally Public for reusable marketing/educational clips. **Do not assume every Learn stage requires video**: choose text, diagrams, interaction, video, audio, or combinations according to each module's learning objectives.

- Keep original MP4 source files backed up on SharePoint. Upload approved videos to E-Master's YouTube channel and capture the actual YouTube video ID; do not fabricate IDs or claim the REE m02 video is uploaded before it is.
- Store a provider-neutral media reference in module metadata/JSON (provider, external ID, media type, stage, required flag and optional source provenance). The database stores only references/metadata, **not video bytes**. Make the renderer support YouTube embed now and allow a future provider switch without rewriting lesson content.
- Embed YouTube in the authenticated student Learn experience, after authorization/enrollment checks. Unlisted is **not DRM or access control**: the video URL/ID can be shared and watched outside the LMS. Do not promise anti-download, anti-sharing, or private playback.
- Keep answer keys, grading logic, recordings, learner progress, coach feedback, and enrollment protected by server authorization/RLS independently of YouTube. Never include private keys in public module JSON.
- Do not build paid video streaming, signed playback URLs, or DRM for the pilot. Reconsider only if commercial scale, abuse or content sensitivity justifies it.
- Current REE video source is SharePoint `ielts-s-p1-m02 with audio.mp4` (owner-confirmed); its **YouTube ID is still pending**. Existing SharePoint link is an interim source reference, not proof of YouTube integration or verified student playback.
- This is an **architecture decision**, not a claim that YouTube upload, Admin media editor, or YouTube embed player have already shipped. Keep the feature PR in Draft until separately approved and tested.

## Implementation update: Admin JSON Draft preflight (2026-11-25)

**Implemented on draft branch, not deployed:** `src/modules/moduleImport.ts` parses public JSON, rejects known private-answer keys, enforces the current REE manifest shape and fixed six-stage order, and invokes the existing manifest validator. `src/pages/AdminModules.tsx` now has a JSON textarea, "Nạp REE mẫu", validation and a six-stage metadata preview. This is **client-side preflight only**; it neither saves to Supabase nor changes publication state. It is not the full student renderer preview.

**Remaining critical work:** define versioned generic schema beyond the REE-specific manifest; authenticated admin server-side import into Draft with RLS/authorization; isolated database migrations; secure private-answer-key ingestion; immutable versioning; server-side Publish gate; render imported data in the actual student player; browser/mobile E2E. Do not merge or deploy this draft before review/testing. No production database operations have been performed.

## Backend preparation (2026-11-25; not applied)

Created `docs/sql/ielts_module_drafts_ISOLATED_REVIEW_ONLY.sql` as a **review-only** database draft for an append-only admin Draft table, unique module-key/version, admin-only select/insert RLS and preliminary JSON constraints including nested answer-key rejection. No migration has been created or executed, no database environment changed, and the Admin UI still does not save drafts.

**Do not apply as-is:** SQL checks are preliminary, not a complete server-side schema validator; authorization assumes the existing trusted `profiles.role` policy; potential existing schema/role compatibility must be checked in an isolated environment. Need adversarial RLS tests (anon/student/teacher/admin), nested private-key tests, malformed JSON tests, import version collision tests, and integration with a trusted server validation endpoint before enabling writes. Never use client-side validation as a security boundary. The SQL file is not a publish gate or production-ready migration.
