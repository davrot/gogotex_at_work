# SSH Keys — Internal API

Overview

- Endpoint: `GET /internal/api/ssh-keys/:fingerprint` — returns `{ userId }` if found.
- Private endpoints for users: `POST /internal/api/users/:userId/ssh-keys`, `GET /internal/api/users/:userId/ssh-keys`, `DELETE /internal/api/users/:userId/ssh-keys/:keyId`.

Fingerprint format

- Canonical: `SHA256:<base64>` where `<base64>` is the 44-char standard base64 encoding of the 32-byte SHA256 digest.
- Server-side computes fingerprint from OpenSSH public key payload.

Caching & invalidation

- Short-lived positive TTL: `CACHE_LOOKUP_TTL_SECONDS` (default 60s).
- Short-lived negative TTL: `CACHE_NEGATIVE_TTL_SECONDS` (default 5s).
- Invalidation: publish `{ key: <fingerprint> }` on Redis channel `auth.cache.invalidate`.

Rate limiting

- Lookup endpoint is rate-limited per service-origin (default 60 req/min). The service-origin precedence is: `X-Service-Origin` header → mTLS CN → client IP.

Service-origin trust model

- To prevent header forgery, `X-Service-Origin` is only authoritative when injected by a trusted ingress (for example an API gateway) or when the request is authenticated via mTLS or a trusted bearer token. Configure `TRUST_X_SERVICE_ORIGIN=true` plus `TRUSTED_PROXIES` (comma-separated IP list) to enable header-based trust in controlled deployments; otherwise the header will be ignored and the service will fall back to mTLS CN or client IP.

SLOs

- Key lookup: p95 ≤ 50ms. CI includes a micro-benchmark to measure and gate this.

Logs & observability

- Structured events: `ssh_key.create`, `ssh_key.delete`, `auth.ssh_attempt` with `fingerprint`, `userId`, `requestId`.

For operators

- Use `ci/benchmarks/key-lookup-benchmark` to run local SLO checks against this endpoint.
