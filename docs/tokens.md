# Personal Access Tokens

Overview

- Endpoints:
  - `POST /internal/api/users/:userId/git-tokens` — create token, returns plaintext once and `accessTokenPartial` (hashPrefix).
  - `GET /internal/api/users/:userId/git-tokens` — list tokens (masked).
  - `DELETE /internal/api/users/:userId/git-tokens/:tokenId` — revoke.
  - `POST /internal/api/tokens/introspect` — introspect token `{ token }` → `{ active, userId, scopes, expiresAt }`.

Security & hashing

- Tokens are stored hashed. Preferred algorithm: `argon2id` (config `AUTH_TOKEN_HASH_ALGO`).
- `hashPrefix` provides 8-hex-character prefix for UI/mask purposes.
- Migration scripts exist under `services/web/migrations/` for backfilling algorithm/expiry and for re-issuance flows.

Rate limits & observability

- Listing/introspection are rate-limited per service-origin (default 60 req/min).
- Introspection SLO: p95 ≤ 100ms; micro-benchmarks exist in CI.

Runbook notes

- Plaintext token is only returned once at creation — store it securely in secrets manager if you need to save it for users.
- For large-scale re-issues, use `rewrite-token-hashing.js` migration which can run in dry-run mode and supports chunking.
