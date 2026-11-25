# E-Master IELTS Coaching — Master Context
Updated: 2026-11-25. Status: shared working context; review before merging.

## Purpose
Build a coach-centered IELTS coaching product at learn.e-master.vn. Learners follow a personalized roadmap and weekly tasks, study micro-modules, submit evidence, receive coach feedback, revise and demonstrate mastery. The product is **not** a generic LMS and should remain coaching-first.

## Current pilot direction
- IELTS-only pilot (later expansion is out of pilot scope).
- Commercial validation gate: 10 paying learners; no claim that gate has been reached.
- Production target previously discussed: 12 micro-modules in two weeks, original due date 2026-11-23; completion **unverified**.
- Content authored by Nhựt/Josh is stored in the E-Master SharePoint IELTS Coaching project. Preserve the source, do not silently edit teaching content.
- Start implementation with the REE / Simple Answer Development (Part 1) module, then the three other reviewed packages.

## System of record
1. GitHub repo: code, reviewed implementation contracts, agreed product decisions and backlog.
2. SharePoint: authoritative source for learning packages and videos.
3. ChatGPT Project: brainstorming and conversation, **not** automatically visible to Codex.
4. Supabase: runtime records; shared production backend with test.e-master.vn. Changes require explicit authorization.
5. Vercel: preview/deployment. A ready deployment is not proof of authenticated workflow success.

## Existing architecture
Vite 6, React 19, TypeScript, Tailwind, Supabase. Student/teacher/admin role mapping (teacher is coach), enrollment, roadmap, weekly plan, tasks, submissions, coach review and revision history. Reuse existing authenticated session, RLS, RPC and private storage. See docs/ARCHITECTURE_V1.md, docs/DATABASE_V1.md and docs/CODEBASE_MAP.md.

## Micro-module experience
Discover → Learn → Practice → Apply → Reflect → Verify.
- Distinguish completion from mastery.
- Version content and preserve historic attempts/coach reviews.
- Interaction engine must support source-actual MCQ, matching, fill blank, written response, audio recording, reflection/checklists. Ordering and evidence highlighting are future-capable types, not permission to invent exercises.
- Rubrics are module-specific. Do not translate internal module mastery into official IELTS band scores.
- Coach review and targeted revision remain core to the product.

## Known constraints and risks
- No unapproved production DB migration, RLS edit, data write, production deployment or merge.
- A prior read-only audit flagged potential privilege escalation via profiles.role updates and signup metadata; owner deferred remediation. See docs/IMPLEMENTATION_STATUS.md; do not treat as resolved.
- SharePoint source access in ChatGPT does **not** imply Codex has it.
- Audio/video assets require verification and secure delivery; no invented mappings.
- Existing historical specs may mention multi-program support and an earlier slice; current IELTS pilot decisions take precedence only for current feature scope, not schema changes.

## Source gaps
The latest local originals of 00_MASTER_CONTEXT.md, 01_DECISION_LOG.md, BACKLOG.md and PILOT_10_LEARNERS.md were not available for verbatim reconciliation in this documentation pass. This is a curated cross-system handoff, not a claim to have copied those files. Reconcile them when available.
