# Example Feature Plan — SSH + HTTPS Git Auth (Example)

## Architecture / Stack

- `services/web` (Node.js/Express, Mongoose) — hosts SSH key and token APIs and token introspection endpoint.
- `services/git-bridge` (Java, Maven) — handles SSH and HTTP git access and must call introspection and SSH key lookup endpoints.
- Data store: MongoDB collections for `user_ssh_keys` and `personal_access_tokens` (hashed secrets).

## Data Model References

- `services/web/app/src/models/UserSSHKey.js` — stores SSH keys: { userId, keyName, publicKey, fingerprint, createdAt }
- `services/web/app/src/models/PersonalAccessToken.js` (new) — stores token metadata and hashed secret.

## Phases

1. Implement backend models + controllers (SSH keys already present; add `PersonalAccessToken` manager). (phase: backend)
2. Implement token introspect endpoint and wiring for `Oauth2Filter` fallback. (phase: integration)
3. Wire `SSHAuthManager` / `git-bridge` to use key→user mapping and membership check. (phase: integration)
4. Add frontend pages / UI stubs for token management and SSH keys (phase: frontend).
5. Tests: unit, contract (introspection shape), and E2E (create token/key → attempt clone). (phase: test)
6. Instrument metrics & SLO monitoring: Ensure `ssh.key_lookup` and `token.introspect` expose timers/histograms and add CI SLI checks (tie to T035/T026) (phase: observability).

## Technical Constraints

- External `oauth2` service may be unavailable; the token manager must be a safe fallback and designed to be optional when OAuth2 is restored.
- Tokens MUST be hashed using a strong, configurable algorithm. The canonical algorithm choice and parameters are defined in the feature spec; see `.specify/features/example/spec.md` under "Non-Functional Requirements" for the authoritative hashing policy (recommended: `argon2id` with sensible defaults and a `bcrypt` fallback). Implementations SHOULD reuse an existing helper (for example `@overleaf/access-token-encryptor`) when it provides the required algorithm and parameter control; otherwise vendor a minimal, auditable implementation and document chosen parameters in the feature README. Implementations MUST also store the hashing algorithm as part of token metadata and include a documented migration/backfill plan to re-hash or re-issue tokens where the algorithm changes (see tasks T002b/T015).
- Avoid long-lived caches for membership decisions; caches MUST use short TTLs and offer an invalidation hook on membership changes.

Note: the `V0ReplacementAdapter` (legacy snapshot parity) is a substantial integration effort; if its scope grows beyond the auth work, move it to a dedicated feature (for example `.specify/features/v0-replacement`) and reference that feature from this plan/tasks list.

## Configuration & Deployment Notes

- The feature defines configuration keys for token hashing and cache tuning in the spec; implementers MUST wire these into the service configuration system. Example keys: `AUTH_TOKEN_HASH_ALGO`, `AUTH_TOKEN_ARGON2_TIME`, `AUTH_TOKEN_ARGON2_MEMORY_KB`, `AUTH_TOKEN_ARGON2_PARALLELISM`, `AUTH_TOKEN_BCRYPT_COST`, `CACHE_LOOKUP_TTL_SECONDS`.
- Membership API: define and include an API contract for membership checks used by `git-bridge`. This contract should declare both the path and minimum authentication required for `git-bridge` to call (example: `GET /internal/api/projects/{projectId}/members/{userId}`). Create a contract file and include tests in integration/contract phases (T030+).
- CI: the key→user lookup micro-benchmark (T026) must specify a runner profile (recommended: 2 vCPU, 4GB RAM) and reproducible harness parameters; include baseline artifact upload to CI for historical comparison. Add a companion introspection micro-benchmark (T026b) that measures introspection p50/p95/p99 for both local introspection and OAuth2 fallback paths; this job MUST be gated in CI and use the same runner profile for comparability.

## Rollout & Migration

- Roll out `token-introspect` and `PersonalAccessToken` behind a feature flag. Suggested flag name: `feature.git_auth.local_token_manager` (default: `false`). Deploy in stages: enable internally (canary) → monitor metrics (auth error rate, lookup latency, introspection latency, audit logs) → enable for a subset of orgs → full rollout. Ensure `Oauth2Filter` can be configured to call the local introspection endpoint when the external service is offline and document configuration for fallback.

## Constitution Check

This feature explicitly aligns with the following constitution principles:

- Code Quality (NON-NEGOTIABLE): All new code must adhere to the highest standards of code quality. This includes following existing `services/web` conventions, using linters, and including unit tests for all new functionality.
- Testing Standards (NON-NEGOTIABLE): Comprehensive testing is mandatory, including unit tests for managers, contract tests for endpoints (`/internal/api/tokens/introspect` and `/internal/api/users/:userId/ssh-keys`), and an end-to-end test covering both SSH and HTTPS paths.
- User Experience Consistency: Adherence to design system and accessibility (WCAG AA) for all user-facing UI components.
- Performance: Service level objectives (SLOs) must be documented, with a specific focus on ensuring that key lookup p95 latency is ≤ 50ms and token introspection p95 latency is ≤ 100ms. A micro-benchmark test for the key lookup path must be included in the continuous integration (CI) pipeline, and CI jobs MUST gate merges when thresholds are exceeded.
- Observability & Versioning: The feature must emit structured logs for all create, delete, and use events. Additionally, metrics for token and key creation, as well as introspections, must be instrumented and monitored. Public APIs must follow semantic versioning with backward compatibility where possible. Cross-service requests (e.g., SSH auth → membership checks) MUST include distributed tracing instrumentation (request IDs, trace IDs, serialized in structured logs).

**Gates Verified:**

- Code review required: PRs must include reviewers, migration/rollback plan for large changes.
- Tests block merges: Unit tests for logic, integration tests for service interactions, E2E tests for journeys.
- SLO validation: CI benchmarks gate merges when thresholds are exceeded (specific CI jobs: `benchmark-key-lookup-slo` and `benchmark-introspection-slo`).
- Documentation: README must document chosen token hashing algorithm and parameters (see spec for details).
- Internationalization: Error messages and timestamps MUST be timezone-aware and localizable; all user-visible text MUST include i18n keys for translation.

## Risks

- Security risk if tokens are stored or displayed in plaintext. Mitigation: return plaintext only on creation and store hashes only.
- Operational complexity if per-key allowed-repo lists are used; prefer membership checks at git RPC time or forced-command wrapper.
