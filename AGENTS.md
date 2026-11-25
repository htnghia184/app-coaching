# AI coding instructions — E-Master Personal Coaching

## Source of truth and authority
- GitHub repository `htnghia184/app-coaching` is the implementation source of truth. Check branch/commit SHA before work.
- Product decisions live in the separate E-Master Coaching project documents: `00_MASTER_CONTEXT.md`, `01_DECISION_LOG.md`, `BACKLOG.md`, `PILOT_10_LEARNERS.md`. These are NOT assumed to be committed in this repository. Request the latest versions if unavailable; do not invent their contents.
- Current product direction in the supplied 2026-11-17 handoff: IELTS-only pilot, 10 paying learners commercial gate, and a separate 12-micro-module production target (original due date 2026-11-23, current completion unverified). Confirm any changes with product owner.
- HQ/ChatGPT reviews and coordinates; Trae/local developer owns app implementation unless product owner explicitly changes responsibilities. Never silently modify production or merge to main.

## Read efficiently
1. Read this file, `README.md`, `docs/CODEBASE_MAP.md`, and `docs/IMPLEMENTATION_STATUS.md`.
2. Check current HEAD and changed files since the last known commit.
3. Open only the affected components, services, types, and tests. Expand scope for cross-cutting changes or stale documentation.
4. Distinguish documented design, code present, test passed, deployment observed, and production DB verified.
5. Update the map/status only when evidence changes; record the exact commit and test command/result.

## Architecture and safety
- Vite 6 / React 19 / TypeScript / Tailwind; Supabase client under authenticated user session.
- Shared Supabase production backend with `test.e-master.vn`; this frontend repo does not own DB migrations.
- Respect RLS. Never expose service-role credentials or secrets in frontend, logs, commits, or documentation.
- Student submission updates use RPC `update_own_coaching_submission`; coach reviews use RPC `review_coaching_submission`.
- Attachments belong in private `coaching-submissions` storage; generate expiring signed URLs.
- Do not run migration 018/019/020, alter RLS, write production data, or run data-writing E2E scripts without explicit approval and verified test environment.
- PWA should cache app shell only; never cache authenticated API responses or private learner content.

## Feature scope and quality gates
- Preserve existing auth, role guards, enrollment, roadmap, weekly plan, task, submission, feedback, revision and offline behavior.
- IELTS micro-module target contract (not evidence of implementation): stable ID/version/outcomes/prerequisites, Discover → Learn → Practice → Apply → Reflect → Verify, separate completion and mastery, attempts and feedback; six interaction types: `multiple_choice`, `fill_blank`, `matching`, `ordering`, `highlight_evidence`, `audio_text_submission`. The last requires coach rubric/review. Start with one end-to-end module before bulk population.
- Run `npm run typecheck` and `npm run build` for application changes. Report PASS/FAIL/NOT EXECUTED truthfully. Existing E2E scripts can write data: inspect before running.
- Prefer small scoped branches and reviewed PRs. Do not claim a feature is deployed, RLS-safe, or E2E-passed without evidence.

## Task handoff format
Report: base/head SHA; scope and assumptions; files inspected; files changed; behavior and security implications; tests with exact commands/results; unverified items; next owner/action; PR link. Never replace uncertainty with guessed status.
