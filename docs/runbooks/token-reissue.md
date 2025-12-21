# Runbook: Token Reissue (High-Level)

Purpose

- Safely re-issue personal access tokens when changing hashing algorithm or rotating secrets.

Preconditions

- Ensure `rewrite-token-hashing.js` migration has been reviewed and tested in staging.
- Ensure `AUTH_TOKEN_HASH_ALGO` and encryptor settings are set in environment (`ENCRYPTOR_KEY`, etc.).

Steps

1. Run in dry-run to estimate impact:
   node services/web/migrations/rewrite-token-hashing.js dryrun
2. Schedule a maintenance window for production or perform a phased rollout (canary/region-by-region).
3. Re-run migration with chunk size and `--migrate` flag:
   node services/web/migrations/rewrite-token-hashing.js migrate --chunk 1000
4. The migration stores reissued plaintexts in `personal_access_token_reissues` (encrypted). Establish secure retrieval mechanism for admins.
5. Monitor logs for `token.reissue` events and validate SLOs for introspection and login flows.

Rollback

- If issues arise, abort further migration runs. Existing tokens remain valid until reissued tokens are propagated; use the `replacedBy` metadata to track status.

Post-migration

- Rotate any encryptor keys used to store reissued plaintexts and remove stored plaintexts after secure delivery.
- Notify downstream consumers (e.g., `git-bridge` or operators) about the migration completion and any necessary configuration changes.
