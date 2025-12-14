Feature: SSH + HTTPS Git Auth — Notes

Summary

- This branch adds support for personal access tokens, a private fingerprint→user lookup API, short-lived lookup caching with Redis-based pubsub invalidation, per-service-origin rate limiting, metrics for SLOs, and migrations to backfill token metadata and to reissue tokens safely.

Key config

- AUTH_TOKEN_HASH_ALGO (argon2id|bcrypt)
- CACHE_LOOKUP_TTL_SECONDS (default 60)
- CACHE_NEGATIVE_TTL_SECONDS (default 5)

SLOs and CI

- Key lookup p95 ≤ 50ms
- Token introspect p95 ≤ 100ms
- Micro-benchmarks: `ci/benchmarks/key-lookup-benchmark` and `ci/benchmarks/introspection-benchmark`

Open items

- Admin UI for retrieving reissued tokens (secure delivery)
- Acceptance environment adjustments to fully run contract tests in CI
- Final runbook & cleanup job for `personal_access_token_reissues`
