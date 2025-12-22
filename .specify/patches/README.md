Patch batch: Revocation immediacy, DELETE semantics, Rate-limit warmup

Summary of proposed changes:

0000-spec-revocation-immediacy.patch

- Update spec to require immediate introspect visibility after revoke and require cache invalidation/purge.

0001-revoke-invalidate-sync.patch

- Update `PersonalAccessTokenManager.revokeToken` to: publish invalidation and synchronously attempt to invalidate the local lookup cache key `introspect:<hashPrefix>` (via `lookupCache.invalidate` or fallback to `set(..., {active:false})`). This ensures introspect returns inactive immediately.

0001b-webprofile-revoke-accept-200.patch

- Update `WebProfileClient.revokeToken` to accept both 204 and 200 as successful replies (log non-204 responses) to maintain parity during rollout.

0002-standardize-delete-204.patch

- Tighten contract test `TokenIntrospectContractTest.mjs` to expect `DELETE` returns 204 on success.

0003-rate-limit-warmup.patch

- Hardens `ServiceOriginRateLimitTests.mjs` warmup to use syntactically-valid token strings (random hex) and adds a pre-check to fail fast if the introspect endpoint is rejecting token format (400).

Next steps:

- Review these patch diffs and approve applying them to the repository.
- After applying, run contract tests locally (recommend `npm run test:contract` or the subset tests) to validate fixes.

Notes:

- These patches are minimally invasive and are designed to fix the contract failures while keeping backwards-compatible behavior where practical.
- If you'd like, I can also add a small unit/integration test verifying that a delegated revoke (webprofile path) also causes local invalidation when webprofile reports success.
