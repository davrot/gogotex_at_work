# Design: Token Introspection (Go port)

## Goal

Port a compatible token introspection endpoint (`POST /internal/api/tokens/introspect`) to Go so that `git-bridge` and `webprofile-api` can perform local introspection with equivalent semantics to the existing Node implementation. This aims to reduce latency and simplify fallback when external OAuth2 is unavailable.

## Requirements

- API shape: accept `{ token }` and return `{ active, userId, scopes, expiresAt }`.
- Hash algorithm compatibility: support `argon2id` with the project's parameter defaults and `bcrypt` fallback. Parameters MUST be configurable via env vars and documented.
- `hashPrefix` semantics: compute/expose prefix exactly like Node (first 8 lowercase hex chars) and avoid returning full hashes.
- Authentication: introspect endpoint must be protected by service-origin or private API auth for internal clients (requireBasicAuth or X-Service-Origin when trusted), same as current Node `requirePrivateApiAuth()` behavior.
- Tests: unit tests for hashing compatibility, contract tests comparing sample Node introspection responses and Go introspection responses for the same token material.

## Approach

1. Implement hashing helpers in Go:
   - Use `golang.org/x/crypto/argon2` for argon2id with defaults from spec (time=2, memory=65536 KB, parallelism=4). Use a salt and encode with base64 similar to Node representation.
   - Use `golang.org/x/crypto/bcrypt` for fallback (bcrypt cost >= 12).
2. Implement `POST /internal/api/tokens/introspect` in `services/git-bridge/cmd/webprofile-api` and expose behind `requireAuth`/`requirePrivateApiAuth`.
3. Add configuration keys to README and `FEATURE_BRANCH_NOTES.md`: `AUTH_TOKEN_HASH_ALGO`, `ARGON2_TIME`, `ARGON2_MEMORY_KB`, etc.
4. Add a small migration test: generate a token via the Node token create endpoint, record the plaintext token, run the Go introspect against the same token and assert the same `active`/`userId`/`scopes` are returned.
5. Add unit tests that validate `hashPrefix` generation and cross-algorithm canonical behavior.

## Security note

- Ensure plaintext tokens are not logged. Tests should assert no plaintexts in logs. The service must only return plaintext token once at creation (unchanged behavior).

## Acceptance criteria

- `POST /internal/api/tokens/introspect` implemented in Go with tests that validate parity against Node introspect for sample tokens.
- Unit tests for hashing & `hashPrefix` pass.
- Contract test added to `services/git-bridge/test/contract` and documented in the Spec Kit.

---

Documented by: Spec Kit — Token Introspection Go port design
