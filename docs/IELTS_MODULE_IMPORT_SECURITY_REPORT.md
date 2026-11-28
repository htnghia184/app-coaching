# IELTS Module Draft import — isolated security test

Date: 2026-11-25. Branch: `codex/ielts-module-engine`. Scope: review-only Draft SQL, not production migration.

## Environment and identity

- Supabase Local Docker container `supabase_db_codex-coaching`, PostgreSQL `postgres` 17.12, Docker host port 54322; Data API `http://127.0.0.1:54321`.
- The test script rejects any other API URL and checks Docker's Local port and DB version before writing. Local CLI anon key and JWT secret were passed only as process environment variables; neither was printed or committed.
- `docs/sql/ielts_module_drafts_ISOLATED_REVIEW_ONLY.sql` was applied to Local with `psql -v ON_ERROR_STOP=1 --single-transaction`. No production connection or migration was used.
- Test users and Draft rows use random `@example.invalid` identities and unique module keys. The test does not reset or delete Local data.

## Results

| Test | Result | Evidence |
| --- | --- | --- |
| Actual Data API RLS: anon/student/teacher/admin read and insert | PASS | `tests/module-import-local.test.mjs`; only admin sees/inserts Draft |
| Actual Data API update/delete, all four roles | PASS | All blocked, including admin |
| Forged `created_by`, signup metadata role, cross-user read | PASS | Direct REST/Data API requests denied |
| Private answer table exposure | PASS | `coaching_private` has no authenticated USAGE; REST table lookup denied |
| Duplicate/invalid version; stage omission/order; nested answer fields | PASS after fix | Direct admin Data API inserts denied |
| Missing/invalid/expired JWT | PASS | Real REST requests; expired JWT signed with Local-only secret |
| Malformed JSON, oversized REST body, unauthorized Published insert | PASS | Real REST requests rejected |
| Draft Publish operation | BLOCKED | No Publish RPC/endpoint exists; not implemented |
| Edge Function runtime and error/log exposure | BLOCKED | Function source inspected; not served/deployed in this run |
| Full generic manifest schema, media/asset validation | BLOCKED | Current SQL enforces minimum structure and denylisted private fields, not a complete versioned schema |

Actual Local run: `node tests/module-import-local.test.mjs` with guarded Local environment: **36/36 PASS**. The earlier run exposed two failures: direct admin REST could insert a manifest without `learn` or with nested `Correct` (case variant). Both were addressed by `ielts_draft_shape_valid` and recursive case-insensitive `ielts_draft_manifest_safe` in the review-only SQL, then retested.

## Security boundary and remaining work

- `authenticated` has SELECT/INSERT but no UPDATE/DELETE on Draft. RLS restricts both SELECT and INSERT to trusted `profiles.role = admin`; `created_by` must equal `auth.uid()`. Anonymous has no table grant.
- The Edge Function uses the caller JWT and anon key, checks `auth.getUser()` plus database profile role, and inserts with caller Authorization. This source inspection is not runtime proof.
- SQL validates the public manifest independently of the Edge Function, but arbitrary unknown fields and deeper semantic rules still need a strict versioned schema before production. The denylist reduces known private-key leaks; it cannot prove all future secret field names are excluded.
- No service-role key is in frontend or endpoint source. Private answer keys remain in `coaching_private`, and Draft cannot be published through this proposal.
- Existing Local synthetic Draft rows from the initial adversarial run include malformed rows inserted before the fix. They are isolated test data, not publishable modules; no reset/deletion was performed.
- Next: run the Edge Function in an isolated runtime, test its HTTP behavior and logs, then replace the preliminary schema validator with a strict versioned contract and repeat Local integration before considering a reviewed migration.
