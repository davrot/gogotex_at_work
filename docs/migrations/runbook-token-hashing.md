# Token hashing reissue migration runbook

Purpose

- Safely migrate personal access tokens from an old hashing algorithm to a new one (e.g., bcrypt → argon2id) with minimal disruption.

Preconditions

- Ensure backups of MongoDB are taken and verified.
- Ensure `services/web` Docker image is built and deployed to staging with the new code containing `rewrite-token-hashing.js`.
- Ensure `ACCESS_TOKEN_CIPHER_PASSWORDS` and `ACCESS_TOKEN_REISSUE_PASSWORD` are set in the environment for reissue encryption.
- Confirm `AUTH_TOKEN_HASH_ALGO` env var can be switched for the migration worker process.

Dry-run

1. In staging, run migration dry-run commands to get counts:
   - `node services/web/migrations/backfill-token-algorithm.js dryrun`
   - `node services/web/migrations/backfill-token-expiry.js dryrun 90`
   - `node services/web/migrations/rewrite-token-hashing.js dryrun <oldAlgo> <newAlgo>`
2. Review outputs and estimate run time (use counts and average reissue time to plan chunking).

Canary (small chunk)

1. Choose a small chunk size (e.g., `--chunk 10`) and run the migrate step on a small subset by invoking the script with `migrate` mode and low chunk size.
   - Example: `node services/web/migrations/rewrite-token-hashing.js migrate bcrypt argon2id 10 false`
2. Verify:
   - The `personal_access_token_reissues` collection has new reissue docs with `delivered: false`.
   - The original tokens are marked `active: false` and `replacedBy` set to new token id.
   - No errors in logs; verify metrics.

Full migration

1. Schedule maintenance window if required (notify ops/QA teams).
2. Run the migration in `migrate` mode with an appropriate `chunkSize` (e.g., 100–1000 depending on throughput), and monitor progress.
   - `node services/web/migrations/rewrite-token-hashing.js migrate bcrypt argon2id 100 true`
   - Use `notify=true` to publish events for downstream delivery/alerts.
3. Monitor:
   - Logs for errors; retry any failed items by identifying updated tokens without `reissuedAt` set.
   - Metrics for token introspection latency, user-reported issues, and audit logs.

Post-migration

- Validate a sample of reissued tokens via introspection and authentication flows.
- Ensure `personal_access_token_reissues` entries are processed (delivery system or admin UI) and mark `delivered` accordingly.
- Remove old algorithm flag/config after validation and update `AUTH_TOKEN_HASH_ALGO` to the new default.

Rollback

- If critical errors occur, pause the migration and investigate. Since tokens are reissued and old tokens are revoked, rolling back requires reactivating old tokens from backups (dangerous). Prefer pausing and resolving issues rather than attempting automated rollback.

Notes

- `rewrite-token-hashing.js` supports `dryrun` and `migrate` modes and chunking.
- Migration should be accompanied by communication to users if tokens are reissued and delivery is needed.
- Always run a dry-run in staging and smoke tests in pre-production before production migration.
