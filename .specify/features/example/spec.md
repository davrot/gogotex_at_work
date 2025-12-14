# Example Feature Spec — SSH + HTTPS Git Auth (Example)

## Overview / Context

This feature implements SSH public-key management and a local HTTPS personal-access-token path for Git access to repositories served through `git-bridge`. The external `oauth2` service may be unavailable; this feature provides a safe interim `PersonalAccessToken` manager and introspection endpoint.

## Clarifications

### Session 2025-12-13

- Q: What is the canonical precedence when deriving a `service-origin`? → A: `X-Service-Origin` header if present, then mTLS client certificate `CN` if available, then client IP. The header should be treated as authoritative when present.

## Functional Requirements

1. User can add/remove SSH public keys for their account. (key-management-add-remove)
   - POST /internal/api/users/:userId/ssh-keys
   - GET /internal/api/users/:userId/ssh-keys
   - DELETE /internal/api/users/:userId/ssh-keys/:keyId

2. SSH public keys are stored with: id, key_name, public_key, fingerprint (SHA256 base64), created_at, updated_at, userId. (ssh-key-model)

3. `git-bridge` can map an SSH public key fingerprint to a `userId` with a measurable latency SLO. See Non-Functional Requirements for SLO definition (key→user lookup p95 ≤ 50ms). Implement a short-lived, configurable cache for lookups. (ssh-key-lookup)

4. Provide a local personal access token manager to issue, list (masked), and revoke tokens while external OAuth2 is unavailable. (token-management)
   - POST /internal/api/users/:userId/git-tokens → returns plaintext token once + masked `accessTokenPartial`
   - GET /internal/api/users/:userId/git-tokens
   - DELETE /internal/api/users/:userId/git-tokens/:tokenId

5. Provide token introspection for `git-bridge`/`Oauth2Filter` to validate tokens locally: POST /internal/api/tokens/introspect { token } → { active, userId, scopes, expiresAt } (token-introspect)

6. Enforce project-membership authorization for git operations: when a git RPC is requested (upload/receive-pack) `git-bridge` must check membership for projectId and userId and deny if not a member. (membership-check)

## Non-Functional Requirements

- Security: tokens MUST be stored hashed. Prefer `argon2id` with conservative default parameters (e.g., time=2, memory=65536 KB, parallelism=4) where available; fallback to `bcrypt` with cost ≥ 12 only if `argon2id` is unavailable. The chosen algorithm and parameters MUST be documented in the feature README. Plaintext token material MAY be returned only once at creation. Store a short `hashPrefix` (first 8 hex chars of the hash) for UI/mask comparisons; never return full hashes. Fingerprints MUST be computed as the SHA256 digest of the public key and encoded in base64. The canonical representation is `SHA256:<base64>` where the base64 payload is the standard base64 encoding of the 32-byte SHA256 digest (44 characters including padding). Service-origin identity is expressed via the `X-Service-Origin` HTTP header; in environments using mTLS or API keys, the service MUST also populate this header for compatibility with rate-limiting and contract tests. The canonical precedence when deriving a service-origin is: 1) `X-Service-Origin` header if present and non-empty; 2) mTLS client certificate `CN` when available; 3) request IP (extracted from `x-forwarded-for` or `req.connection.remoteAddress`) as a fallback. Implementations MUST document how to configure and map these values and MUST prefer the header over other sources when present.

Trust model: to prevent forgery, the `X-Service-Origin` header MUST only be treated as authoritative when injected by a trusted ingress or proxy (for example an API gateway) or when the request is authenticated via a mutually-trusted mechanism (mTLS or a bearer API token). Implementations SHOULD provide configuration flags (for example `TRUST_X_SERVICE_ORIGIN=true` and an explicit `TRUSTED_PROXIES` list) to enable header-based trust only in controlled deployments. If such configuration is not set, services MUST ignore untrusted `X-Service-Origin` headers and fall back to mTLS CN or remote IP.

- Fallback & migration semantics: runtime algorithm selection MUST be explicit via `AUTH_TOKEN_HASH_ALGO`. If set to `argon2id` and the runtime environment lacks argon2 support, the service MUST fail to start unless the config explicitly sets `bcrypt` as a fallback; do not silently fall back. Implementations MUST document detection semantics and fail-fast behavior in the feature README. Migration/backfill tasks MUST record original hash algorithm metadata and include a re-hash or re-issue strategy to support algorithm changes (see tasks T002b and T015).
- Performance: key→user lookup latency <= 50ms p95 in normal conditions; cache TTL for lookups configurable (default 60s).
  - Measurement harness and "normal conditions": benchmarks/SLOs are measured in CI using a reproducible runner profile (recommended: 2 vCPU, 4GB RAM) and a synthetic dataset representative of production (example: 1k-10k keys spread across 200 users). The measurement harness MUST document cold vs warm cache runs; SLOs are measured with a warm cache where appropriate, and CI MUST include cold-cache regression runs. See CI benchmark tasks T026 (key lookup) and T026b (introspection).
- Introspection: token introspection latency p95 ≤ 100ms in normal conditions; introspection endpoints should be instrumented and benchmarked in CI.
  - Measurement harness and "normal conditions": see the general performance harness above. Introspection benchmarks MUST be run for local introspection and OAuth2 fallback paths under representative load; CI MUST publish p50/p95/p99 and fail jobs when thresholds are exceeded. Add task T026b for introspection micro-benchmark coverage.
- Observability: creation/deletion/usage of keys and tokens must emit structured logs with userId, actor, IP, action, resource_id, timestamp.
- Testability: unit tests for managers, contract tests for introspection shape, and an E2E that exercises key creation + git clone (simulated) must exist and pass in CI.

## Rate Limiting

- Abuse protection: endpoints that create or list secrets MUST apply rate limits to prevent credential stuffing and automated abuse. Recommended default limits (tunable via config):
  - Token creation: 5 requests per minute per user, burst up to 10.
  - SSH key creation: 5 requests per minute per user, burst up to 10.
  - Token introspection and key listing: 60 requests per minute per service-origin or API client.
  - Introspection & listing protection: listing and introspection endpoints MUST implement service-origin rate limits (per API client) in addition to per-user limits. Default recommended limits: 60 requests/minute per service-origin. Document how a service-origin is identified (client ID, API key, or token fingerprint) and how to configure the limits. Contract tests must assert that service-origin rate limits are enforced (see tasks T010b and T020).

- Tests: include contract and integration tests that assert rate-limits are enforced (429 responses) under simulated high request rates. Document how to tune the limits in `FEATURE_BRANCH_NOTES.md`.

## User Stories & Acceptance Criteria

- [US1] As a user, I can add a public SSH key and see its fingerprint. Acceptance: POST returns 201 and GET shows the key with correct fingerprint.
- [US2] As a user, I can create a personal access token and copy the token; acceptance: POST returns plaintext token once and subsequent GET shows only `accessTokenPartial`.
- [US3] As an operator, I can introspect a token: POST /internal/api/tokens/introspect returns `active: true` and `userId` for valid tokens.
- [US4] As a git client (SSH), if I present an unknown key I am denied at auth; if key is known but not a project member, my upload/receive-pack is denied with 403 before git operation.
- [US5] As an operator/auditor, I can observe structured logs for token/key events and verify rate-limits and retention; Acceptance: logs include `event`, `userId`, `resourceType`, `hashPrefix`, `timestamp`; retention & masking policies documented and tested.

## Membership Enforcement

Specify where and how project-membership is enforced and how `projectId` is derived from repository paths.

- Enforcement point: membership MUST be checked at the git RPC handler (e.g., during `upload-pack` / `receive-pack` handling) inside `git-bridge` after authentication completes. SSH authentication only maps fingerprint → `userId`; repository-level authorization requires the RPC handler to map incoming repository path → `projectId` and then verify membership.
- Repo-path → projectId mapping: `git-bridge` will parse repository path segments using the repository routing rules used by the product (example canonical mapping: `/repo/{owner}/{slug}.git` → project slug `{owner}/{slug}` → lookup `projectId`). Implementers MUST document exact mapping in the implementation ticket and add unit tests against mapping examples.

### Optional: private fingerprint lookup API

- To support fast fingerprint → userId resolutions, the web service MAY expose a private internal API at:
  - `GET /internal/api/ssh-keys/:fingerprint` — returns `{ userId }` (200) when found, otherwise 404.
- This endpoint MUST be protected via `AuthenticationController.requirePrivateApiAuth()`, implement service-origin rate-limiting (60 req/min default), and only return minimal metadata required to perform auth mapping (no public_key or other PII is returned). The fingerprint format accepted is the canonical `SHA256:<44-char base64>`.

- Failure modes: if authentication fails (unknown key / invalid token) return SSH auth failure (for SSH) or HTTP 401 (for HTTPS). If authentication succeeds but membership check fails, the RPC handler MUST respond with 403 and record the event in audit logs. Do not return 200 with an error payload for git RPCs.
- Acceptance test (example): create user U, add key K, ensure K maps to U; create repo R where U is NOT a member; attempt `git push` over SSH presenting K — outcome: authentication succeeds but RPC is denied with a 403-equivalent response and the `auth.ssh_attempt` audit log contains `userId`, `fingerprint`, `repo`, `outcome: "failure"`, and `reason: "not a project member"`.

## Edge Cases

- Duplicate public keys: adding an exact `public_key` MUST be idempotent for the same `userId`. The API behavior is:
  - If the exact `public_key` already exists for the same `userId`, `POST /internal/api/users/:userId/ssh-keys` MUST return `200 OK` with the existing key resource (idempotent create).
  - If the exact `public_key` exists but is already associated with a different `userId`, the API MUST return `409 Conflict` with an explanatory message.
  - Attempts to create a key with the same `key_name` but different `public_key` SHOULD return `400` with validation guidance.
- Revoked token or key: cache invalidation must reflect revocation within TTL or via explicit invalidation hook.
- Malformed public_key: return 400 with validation errors.

## Data Shapes (examples)

- SSH key object: { id, key_name, public_key, fingerprint, userId, created_at }
- Token object (stored): { id, userId, label, hashPrefix, hash, algorithm, scopes, createdAt, expiresAt }

## Configuration Keys

Define runtime configuration keys and defaults for token hashing and caching:

- `AUTH_TOKEN_HASH_ALGO` (default: `argon2id`) — canonical algorithm to use for token hashing.
- `AUTH_TOKEN_ARGON2_TIME` (default: `2`) — argon2id time/cost parameter.
- `AUTH_TOKEN_ARGON2_MEMORY_KB` (default: `65536`) — argon2id memory in KB.
- `AUTH_TOKEN_ARGON2_PARALLELISM` (default: `4`) — argon2id parallelism.
- `AUTH_TOKEN_BCRYPT_COST` (default: `12`) — bcrypt cost if used as fallback.
- `CACHE_LOOKUP_TTL_SECONDS` (default: `60`) — positive fingerprint→user lookup TTL.
- `CACHE_NEGATIVE_TTL_SECONDS` (default: `5`) — negative lookup TTL.

Implementations MUST surface these configuration keys in service configuration and document how to tune them in `FEATURE_BRANCH_NOTES.md`.

## Token Expiry Policy

- Default lifetime: 90 days. Maximum allowed lifetime: 365 days.
- Short-lived automation tokens: 7 days (recommended for CI/service tokens).
- Clients MAY supply an `expiresAt` ISO8601 field on token creation; the server MUST cap requested expiries to the maximum allowed lifetime.
- Rotation: issuing a replacement token SHOULD NOT automatically revoke the previous token unless the client passes `replace=true` on creation.
- Revocation: `DELETE /internal/api/users/:userId/git-tokens/:tokenId` MUST mark the token inactive immediately and cause subsequent introspection to return `active: false`.
- Migration: deploys MUST include a backfill that assigns `expiresAt` to existing tokens without expiry (default → 90 days) and document the migration plan in `FEATURE_BRANCH_NOTES.md`.

## Scope Model

- Scope syntax: `<resource>:<action>[:<resource-id>]` (examples: `repo:read`, `repo:write`, `repo:admin`, `repo:write:project-123`).
- Canonical repo scopes and mappings:
  - `repo:read` → allows `git-upload-pack` (clone/fetch).
  - `repo:write` → allows `git-receive-pack` (push).
  - `repo:admin` → allows administrative actions (create/delete repos, manage hooks).
- Resource-scoped tokens (with `resource-id`) limit the token to the named project/repo; tokens without a `resource-id` are global and must be issued with caution.
- Tokens without any scopes MUST be rejected for git access.
- Introspection response `scopes` is an array of scope strings; `git-bridge` MUST evaluate scopes to determine allowed RPC actions.

## Structured Log Schema

Services MUST emit structured JSON logs for token and SSH key events. Minimum fields:

- `event` (string) — e.g., `ssh_key.create`, `token.create`, `token.introspect`, `auth.ssh_attempt`
- `service` (string) — e.g., `web`, `git-bridge`
- `level` (string) — `info`/`warn`/`error`
- `userId` (string|null)
- `actorId` (string|null)
- `actorIp` (string|null)
- `resourceType` (string) — `ssh_key` | `personal_access_token` | `membership`
- `resourceId` (string|null) — use token id or key id; for tokens log `hashPrefix` (first 8 hex chars) instead of full hash
- `fingerprint` (string|null) — for SSH events
- `action` (string) — `create`/`delete`/`use`/`introspect`
- `outcome` (string) — `success`|`failure`
- `reason` (string|null)
- `requestId` (string|null) and `traceId` (string|null)
- `timestamp` (ISO8601)

Example:

{"event":"token.introspect","service":"web","level":"info","userId":"u-42","actorId":null,"actorIp":"1.2.3.4","resourceType":"personal_access_token","resourceId":"tok-abc123","action":"introspect","outcome":"success","reason":null,"scopes":["repo:read:proj-7"],"requestId":"r-123","timestamp":"2025-12-11T12:34:56Z"}

## Cache TTL & Invalidation

- Defaults:
  - Positive lookup TTL: 60s (configurable, recommended max 300s)
  - Negative lookup TTL (miss): 5s
  - Acceptable stale window for revocation: 60s unless immediate invalidation is requested
- Invalidation mechanisms:
  - Primary: publish an invalidation message to a shared channel `auth.cache.invalidate` with payload `{ type, id, fingerprint?, projectId?, reason }`; all service instances should subscribe and purge caches on receipt.
  - Secondary: synchronous API `POST /internal/api/cache/invalidate` for urgent invalidation requests.
- Cache keys:
  - SSH keys: `ssh:fingerprint:{fingerprint}` → `{ userId, expiresAt }`
  - Tokens: keyed by `token:hashprefix:{hashPrefix}` or a hashed lookup; store `{ active, scopes, expiresAt }`.
- On any `DELETE`/revoke or membership change, services MUST publish an invalidation message.

```

```
