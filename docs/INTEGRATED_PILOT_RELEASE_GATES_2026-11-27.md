# Integrated pilot release gates — 2026-11-27

This branch merges the two prototype tracks and exposes a synthetic Coach/Student preview at `/prototype/integrated-pilot`. It is not connected to real learners. The existing authenticated enrollment, roadmap, weekly plan, task, submission, review and revision pages remain the production spine; no database change was applied.

## Implemented in this branch

- The four generic module previews now reference the four pilot Speaking LO IDs. Coach assignment selection includes the module content version; direct-task and live-session paths remain independent. Synthetic student submissions and revisions create separate evidence records. Coach assessments are append-only in the preview, and coach work uses entered minutes.
- The review-only LO SQL proposal uses submission revisions and live-session notes as evidence sources, rather than REE-specific module attempts. Priorities can be deactivated. It has not been executed.
- The review-only media resolver requires an exact allowed origin for browser calls and matches an asset to a media activity in the requested module manifest and content version. Private asset configuration is keyed by module ID, version and asset reference. No assets or IDs are bundled in the frontend.

## Release blockers

1. **Isolated database and authenticated E2E.** Docker daemon is unavailable. The repository does not provide a verified complete baseline for a disposable local database. The owner must provide or authorize a separate Supabase test project with the current schema, storage policies, and disposable users. Run the SQL proposal and authenticated E2E there, including cross-enrollment denial, immutable assessment history, versioned evidence, media and existing assessment application boundaries. Shared production is excluded.
2. **Schema reconciliation.** The review-only SQL assumes `coaching_submission_revisions` and current `learning_modules.contentVersion`; these need verification in the isolated baseline. The existing REE proposal uses `content_version` and UUID module rows. Generic module IDs and version-pinned task assignments require a reviewed mapping and immutable published module-version storage before real writes or media authorization. The synthetic preview does not establish that mapping.
3. **Teaching source parity.** Four structural previews have placeholder content. An authorized admin must privately import the authentic SharePoint package content and media mapping into an isolated draft environment, then complete academic parity and publication review. No private teaching assets have been copied into this repository.
4. **Live integration.** The unified preview demonstrates decisions and revision state only. It does not exercise authenticated Supabase RPCs, Storage, module progress, or the existing assessment application. Do not treat build or HTTP success as authenticated E2E evidence.

The existing four-module content specification remains the subsystem contract; module completion alone never establishes LO mastery.
