# Example Feature Plan — SSH + HTTPS Git Auth (Example)

## Architecture / Stack

- `services/web` (Node.js/Express, Mongoose) — hosts SSH key and token APIs and token introspection endpoint.
- `services/git-bridge` (Go, Go modules) — handles SSH and HTTP git access and must call introspection and SSH key lookup endpoints. **Decision:** implement `git-bridge` in Go (golang) due to lack of Java maintainers; see Phase 0 in `tasks.md` for migration tasks.
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

### Go migration approach (2025-12-20)

- Overview: Migrate `services/git-bridge` from Java to a new Go implementation in a phased manner to minimize disruption. The migration prioritizes feature parity for authentication, membership checks, and audit logging, and also aims to preserve contract compatibility.
- Phases:
  1. Add a new Go module in `services/git-bridge` with a minimal `main` and package layout; provide development `Makefile` and devcontainer/Dockerfile updates to install Go (see `T040`). Run Go unit tests in parallel with existing Java tests during the initial phase to validate parity.
  2. Port core features (SSH auth, fingerprint lookup, introspect client, membership enforcement) to Go and add equivalent unit tests and benchmarks (`T042`/`T043`/`T044`). Keep the Java build around until contract/integration tests pass consistently against the Go binary in CI.
  3. Replace CI build steps to build and test the Go binary, update benchmark jobs to target the Go binary, and ensure gates pass (`T041`).
  4. When parity and CI stability are proven, deprecate and remove Java sources and Maven configs (`T045`) and finalize docs (`T046`).

- Rollout & validation: Use contract tests and the CI benchmark gating to assert parity; ensure E2E tests exercise the deployed Go binary; incrementally remove Java artifacts only after CI contracts and benchmarks pass for a configurable period (for example, one week of green runs).

## Constitution Check

- Code Quality: use linters and follow existing `services/web` conventions; new code must include unit tests.
- Testing Standards: unit tests for managers, contract tests for endpoints (`/internal/api/tokens/introspect` and `/internal/api/users/:userId/ssh-keys`), and an E2E covering both SSH and HTTPS paths are required.
- Observability: emit structured logs for create/delete/use events and instrument metrics for token/key creation and introspections.
- Performance: document SLOs (key lookup p95 ≤ 50ms) and include a short benchmark in CI for the key lookup path.

## Risks

- Security risk if tokens are stored or displayed in plaintext. Mitigation: return plaintext only on creation and store hashes only.
- Operational complexity if per-key allowed-repo lists are used; prefer membership checks at git RPC time or forced-command wrapper.

```

```
