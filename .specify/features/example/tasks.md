# Tasks: SSH + HTTPS Git Auth (Consolidated) — Final

This file is the final single-copy of deduplicated tasks for the SSH + HTTPS Git Auth feature. Each entry is unique and contains a short description and acceptance criteria.

## Phase 1 — Setup

- [x] T001 Validate project structure, spec and plan presence — .specify/features/example/plan.md, .specify/features/example/spec.md
- [x] T002 Add CI micro-benchmark skeleton and harness — ci/benchmarks/, .gitlab-ci.yml
- [x] T003 Ensure linting plugin & config present — libraries/eslint-plugin/index.js
- [ ] T004 (BLOCKING) Config validation & hash availability checks — services/web/app/src/config/validateConfig.mjs, services/web/app/src/config/hashAvailability.mjs
  - Acceptance: Service fails start-up when `AUTH_TOKEN_HASH_ALGO=argon2id` without runtime support and fallback is not configured.

## Phase 2 — Foundational

- [ ] T005 DB migrations & example fixtures for keys/tokens — services/web/migrations/, services/web/test/fixtures/
- [x] T006 Models: UserSSHKey + PersonalAccessToken — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js
- [x] T007 Token manager & introspection logic — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [x] T008 Token controller & introspect endpoint — services/web/app/src/Features/Token/TokenController.mjs
- [ ] T009 Structured logging + PII retention policy — services/web/lib/log-schemas/auth-events.json, docs/logging-policy.md

## US1 — SSH Keys

- [ ] T010 SSH Keys CRUD controller & routes (private) — services/web/app/src/Features/User/UserSSHKeysController.mjs
  - Acceptance: private API auth enforced; create returns 201/200 idempotently; duplicates handled.
- [ ] T011 Server-side fingerprint compute & validation — compute SHA256 base64, validate format
  - Acceptance: 400 on malformed fingerprint; fingerprint stored and returned in GET.
- [ ] T012 Contract tests for SSH keys — services/web/test/contract/ssh-keys/**
  - Acceptance: contract asserts create/list/delete/duplicate behavior.
- [ ] T013 Frontend UI for SSH keys — services/web/frontend/js/features/settings/components/SSHKeysPanel.tsx
  - Acceptance: UI shows fingerprint and supports add/remove.

## US2 — Personal Access Tokens

- [x] T014 Token model & hashPrefix — services/web/app/src/models/PersonalAccessToken.js
- [x] T015 Token manager lifecycle & `replace=true` semantics — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [x] T016 Token controller uses introspect endpoint — services/web/app/src/Features/Token/TokenController.mjs
- [ ] T017 Unit & integration tests for token lifecycle — services/web/test/unit/**, services/web/test/integration/**
- [ ] T018 Migration/backfill scripts for expiry & algorithm metadata — services/web/migrations/backfill-token-expiry.js, services/web/migrations/rewrite-token-hashing.js

## US3 — Git Auth Integration

- [ ] T019 Fingerprint → user fast lookup (private API) — GET /internal/api/ssh-keys/:fingerprint
  - Acceptance: returns 200 { userId } or 404, 400 for malformed; protected by `requirePrivateApiAuth()` and service-origin rate limit.
- [ ] T019a Contract test for fingerprint lookup — services/web/test/contract/src/SSHKeyLookupContractTest.mjs
- [ ] T020 Short-lived cache + pubsub invalidation — services/web/app/src/lib/cache.js, services/web/lib/pubsub.js, services/git-bridge cache handling
  - Acceptance: TTL default 60s; invalidation published on revoke/delete.
- [ ] T021 Wire `git-bridge` to call introspection fallback & fingerprint lookup — services/git-bridge/src/main/java/**/SSHAuthManager.java
  - Acceptance: `git-bridge` uses fast-path lookup and falls back to old behavior gracefully.
- [ ] T022 Membership enforcement at RPC handler — git-bridge RPC handlers, membership API contract
  - Acceptance: non-member push returns 403; membership contract verified.
- [ ] T023 Contract test + E2E for git-bridge auth/membership flow — services/git-bridge/test/contract/**, services/web/test/e2e/

## US4 — Observability, Rate-Limits & Security

- [ ] T024 Rate limiting & service-origin controls — services/web/app/src/infrastructure/RateLimiter.js
  - Acceptance: introspect/list endpoints rate-limited per service-origin; token/ssh-key creation per-user limits enforced.
- [ ] T025 Contract tests to assert rate-limits & logging masking — services/web/test/contract/rate-limit-service-origin/**, services/web/test/contract/logging/**
- [ ] T026 CI benchmarks for SLOs — key-lookup p95 ≤ 50ms; introspect p95 ≤ 100ms — ci/benchmarks/*
  - Acceptance: CI job artifacts include p50/p95/p99 and gating.

## Final — Documentation, Security & Accessibility

- [ ] T027 Documentation & rollout notes — docs/tokens.md, docs/ssh-keys.md, FEATURE_BRANCH_NOTES.md
- [ ] T028 Security review & privacy checklist — docs/logging-policy.md
- [ ] T029 Accessibility & frontend e2e screens — services/web/test/e2e/**
- [ ] T030 Add membership OpenAPI contract — specs/001-ssh-git-auth/contracts/membership.openapi.yaml
- [ ] T031 Add contract test for membership endpoint — services/git-bridge/test/contract/MembershipContractTest.java
- [ ] T032 Security review checklist & retention policy verification tests — test/contract/logging/**
- [ ] T033 CI micro-benchmark gating & contract validation (parallel) — .gitlab-ci.yml / Jenkins
- [ ] T034 Accessibility tests & frontend e2e (parallel) — services/web/test/e2e/**

## Notes

- `T004` is explicitly blocking: must be completed before token hashing algorithm changes. If `AUTH_TOKEN_HASH_ALGO=argon2id` and argon2 not available at runtime, start-up must fail unless fallback is explicitly configured.
- Create missing docs referenced above and link them to task owners.
- If a task needs to be subdivided, use `TXXXa`, `TXXXb` while preserving the base TID uniqueness.
