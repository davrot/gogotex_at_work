# Tasks: SSH + HTTPS Git Auth

**Input:** Extracted from: .specify/features/example/plan.md, .specify/features/example/spec.md

## Phase 1: Setup

- [x] T001 Validate feature docs and plan presence — .specify/features/example/plan.md, .specify/features/example/spec.md (docs present)
- [x] T002 [P] Add CI micro-benchmark skeleton and harness — ci/benchmarks/ (key-lookup + introspection harnesses implemented)
- [x] T003 [P] Ensure linting plugin & config present and applied — libraries/eslint-plugin/ (lint plugin present)
- [x] T004 (BLOCKING) Implement config validation & runtime hash availability check — services/web/app/src/config/validateConfig.mjs, services/web/app/src/config/hashAvailability.mjs (implemented; unit tests exist)
  - Acceptance: Service fails to start when `AUTH_TOKEN_HASH_ALGO=argon2id` and argon2 not supported unless an explicit fallback is configured.
- [x] T002b Add migration/backfill for PersonalAccessToken re-hash & metadata — services/web/migrations/re-hash-personal-access-tokens.mjs (migration script present)
  - Acceptance: Migration preserves original algorithm metadata (`algorithm`/`hashPrefix` fields), provides a safe re-hash or re-issue strategy (idempotent, reversible steps documented), and includes tests or a dry-run mode to validate behavior.
  - Depends on: **T004** (config validation & runtime hash availability check). Do not run or merge the migration before T004 is completed and verified in a staging environment.

- [x] T001a (BLOCKING) Constitution compliance check — .specify/memory/constitution.md, CI pipeline (implemented: `scripts/ci/check_constitution.sh` + `.github/workflows/check-constitution.yml`)
  - Acceptance: PRs that implement or change this feature MUST include and pass the constitution checklist: linters, unit & contract tests, and benchmark gating (T033) where applicable. The new workflow runs the script on pull requests.

- [x] T0AA (BLOCKING) Formalize benchmark runner profile & harness — ci/benchmarks/README.md, ci/benchmarks/harness-config.json (implemented)
  - Acceptance: Provide a reproducible runner profile (recommended 2 vCPU, 4GB RAM), a seeded dataset (documented seed and size), harness command-lines, artifact format (p50/p95/p99), and example invocation for warm/cold runs. The harness must be runnable in local/dev CI and in the CI runner used for gating.

- [x] T0YY Add canonical repo-path → projectId mapping examples & parsing unit tests — specs/001-ssh-git-auth/examples/repo-paths.md, services/git-bridge/test/unit/RepoPathParsingTest.java (examples + tests added)
  - Acceptance: Add canonical mapping examples (including `.git` suffix handling, url-encoded paths, namespaces, leading/trailing slashes) and unit tests that assert canonical parsing results and edge case behaviors.

- [x] T0ZZ Add idempotency concurrency contract test for SSH key POST — services/web/test/contract/src/SSHKeyIdempotencyContractTest.mjs (implemented)
  - Acceptance: Concurrent `POST /internal/api/users/:userId/ssh-keys` with the same `public_key` must deterministically return the same resource (200 idempotent response) and avoid duplicate entries (or return 409 with explanatory message if a different user owns the key). Include a deterministic test harness to simulate concurrent requests.

---

## Phase 2: Foundational

- [x] T005 Setup DB migrations & example fixtures for keys/tokens — services/web/migrations/, services/web/test/fixtures/
- [x] T006 [P] Verify/implement models: UserSSHKey + PersonalAccessToken — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js (implemented)
- [x] T007 [P] Verify/implement PersonalAccessToken manager & introspection logic — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs (implemented)
- [x] T008 [P] Verify/implement Token controller & router (create/list/remove/introspect) — services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/Features/Token/TokenRouter.mjs (implemented)
- [ ] T009 [P] Add structured logging schema & PII retention policy — services/web/lib/log-schemas/auth-events.json (implemented), docs/logging-policy.md (TODO)
  - Acceptance: Logging schema includes `hashPrefix` fields and a masking policy; unit/contract tests verify that full token hashes are never emitted in logs, `hashPrefix` is present for token events, and retention rules are enforced (tests for retention behavior or a dry-run validation). **Status:** schema exists at `services/web/lib/log-schemas/auth-events.json`; **next:** add `docs/logging-policy.md` documenting retention/masking and add contract tests to verify masking and retention behavior.

---

## Phase 3: User Story 1 — SSH Key Management (US1) (Priority: P1) 🎯 MVP

**Goal:** Allow users to add/remove SSH public keys and display canonical fingerprint.

**Independent Test:** Create a user, POST an SSH key, GET the key list and verify fingerprint format `SHA256:<base64>` and idempotent create behavior.

- [x] T010 [P] [US1] Ensure SSH Keys CRUD controller & private routes exist and enforce auth — services/web/app/src/Features/User/UserSSHKeysController.mjs
- [x] T011 [P] [US1] Implement server-side fingerprint computation & validation (SHA256 base64) — services/web/app/src/models/UserSSHKey.js
- [x] T012 [US1] Add contract tests for SSH keys endpoints — services/web/test/contract/src/SSHKeyCRUDContractTest.mjs
- [ ] T013 [US1] Implement & test frontend UI for SSH keys (inline validation & ARIA) — services/web/frontend/js/features/settings/components/SSHKeysPanel.tsx, services/web/test/frontend/features/settings/components/ssh-keys.test.tsx
  - Acceptance: UI must pass automated accessibility checks (WCAG AA baseline via axe or Lighthouse), include ARIA labels/roles, be keyboard-navigable, and include unit/visual tests that run in CI (`services/web/test/frontend/**`). Add an accessibility test that asserts correct focus management and an axe check as part of `T031` gating.

---

## Phase 4: User Story 2 — Personal Access Tokens (US2) (Priority: P1)

**Goal:** Allow users to create, view (masked), copy plaintext once, and revoke personal access tokens.

**Independent Test:** Create a token via POST and verify returned plaintext token once; subsequent GET shows `accessTokenPartial` only.

- [ ] T014 [P] [US2] Verify Token model includes `hash`, `hashPrefix`, `algorithm`, `scopes`, `expiresAt` — services/web/app/src/models/PersonalAccessToken.js
- [ ] T015 [P] [US2] Unit tests for token lifecycle & `replace=true` semantics — services/web/test/unit/src/Features/Token/Rotation.test.mjs
  - Acceptance: Unit tests must assert that when `replace=true` is passed on create, the previous token is marked inactive (introspection returns `active: false`), the new token is active, and stored metadata includes `algorithm` and `hashPrefix`. Tests should be deterministically runnable in CI and avoid DB casting issues (use in-memory model mocks or valid ObjectId fixtures). Include negative tests for malformed token input.
- [ ] T016 [P] [US2] Integration tests for TokenController create/list/remove endpoints — services/web/test/integration/src/TokenControllerTests.mjs
- [ ] T017 [US2] [P] Frontend: ensure `GitTokensPanel` lists tokens, shows plaintext on create, supports copy-to-clipboard, and handles network errors gracefully — services/web/frontend/js/features/settings/components/GitTokensPanel.tsx, services/web/test/frontend/features/settings/components/git-tokens.test.tsx
  - Acceptance: Plaintext token material is displayed only once on creation (UI must not store or show full hashes afterwards), copy-to-clipboard is accessible (with an ARIA live region announcing copy success), and automated frontend tests include axe accessibility checks and run in CI. The list view must show `accessTokenPartial` (masked) after creation and when re-fetching the token list.
- [ ] T018 [US2] Add contract & service-origin rate-limit tests for token creation/listing — services/web/test/contract/src/ServiceOriginRateLimitTests.mjs
  - Contract test: services/web/test/contract/src/HashPrefixFormatContractTest.mjs — assert `hashPrefix` is 8 lowercase hex characters
- [ ] T019 [US2] Reproduce & fix E2E 404 for GET `/internal/api/users/:userId/git-tokens` seen in Playwright run: inspect TokenRouter, AuthenticationController.requireLogin(), router mounting, and server logs during E2E — services/web/app/src/Features/Token/TokenRouter.mjs, services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/router.mjs, services/web/test/e2e/playwright/out/console.log
  - Acceptance: Playwright run (RESET_DB=true BASE_URL=...) shows no 404 for token list and UI shows token list or empty state instead of generic error.

- [ ] T019b Negative auth tests for fingerprint lookup — services/web/test/unit/src/Features/SSHKey/SSHKeyLookupAuth.test.mjs
  - Acceptance: Unit and contract tests assert that `GET /internal/api/ssh-keys/:fingerprint` rejects unauthorized calls (401/403) via `AuthenticationController.requirePrivateApiAuth()` and that rate-limits are enforced (429 returned when over limit). Include both positive and negative auth cases.

---

## Phase 5: User Story 3 — Token Introspection (US3) (Priority: P2)

**Goal:** Provide token introspection for `git-bridge` and other services.

**Independent Test:** POST `/internal/api/tokens/introspect` with a token and receive `{ active, userId, scopes, expiresAt }`.

- [x] T020 [P] [US3] Verify/implement introspect endpoint & controller tests — services/web/app/src/Features/Token/TokenController.mjs, services/web/test/unit/src/Features/Token/TokenController.test.mjs
- [x] T021 [US3] Add integration & contract tests for introspection shape and error cases — services/web/test/integration/src/TokenIntrospectionTests.mjs, services/web/test/contract/src/TokenIntrospectContractTest.mjs
- [x] T022 [US3] Add micro-benchmark for introspection latency (CI) and gate p95 ≤ 100ms — ci/benchmarks/introspection-benchmark/ (implemented: `ci/benchmarks/introspection-benchmark/bench.js` and CI invocation)

---

## Phase 6: User Story 4 — Git Auth Integration & Membership (US4) (Priority: P2)

**Goal:** Map SSH fingerprint → userId quickly and enforce project membership during git RPCs.

**Independent Test:** Simulate fingerprint lookup → obtain userId; simulate RPC with known user but not a member → observe 403 and audit log.

- [x] T023 [P] [US4] Ensure private fingerprint lookup API exists and is contract-covered — GET /internal/api/ssh-keys/:fingerprint, services/web/test/contract/src/SSHKeyLookupContractTest.mjs (implemented)
- [x] T024 [US4] Short-lived cache and pubsub invalidation for fingerprint lookup — services/web/app/src/lib/cache.js, services/web/lib/pubsub.js (implemented)
- [x] T024b Implement synchronous cache invalidation API & contract tests — POST /internal/api/cache/invalidate, services/web/test/contract/src/CacheInvalidationContractTest.mjs (implemented)
- [x] T025 [US4] Wire `git-bridge` to call fingerprint lookup and introspection fallback path — services/git-bridge/src/main/java/**/SSHAuthManager.java, services/git-bridge/test/contract/**
- [x] T025a Verify git-bridge E2E observes auth.http_attempt success path when valid tokens are used — `scripts/e2e/git-https-acceptance.sh`, `services/web/test/e2e/playwright` (script and e2e checks present)
- [x] T026a [US4] Membership enforcement tests at RPC handler (integration) — `services/git-bridge/src/test/java/.../WebProfileSSHServerMembershipE2ETest.java` (implemented)

---

## Phase 7: Cross-cutting — Observability, Rate-Limits & Security (US5)

- [ ] T036 Add configurable `TRUST_X_SERVICE_ORIGIN` and `TRUSTED_PROXIES` support and tests — services/web/app/src/infrastructure/ServiceOrigin.mjs, services/web/test/unit/src/infrastructure/ServiceOrigin.test.mjs

**Goal:** Structured logs, rate-limits (service-origin + per-user), SLOs, and audits for token/key events.

**Independent Test:** Contract tests assert rate-limits (429) per service-origin; logs contain prescribed fields and `hashPrefix` instead of full hashes.

- [x] T027 [P] [US5] Ensure rate-limiter applied to introspect/list and create endpoints — services/web/app/src/infrastructure/RateLimiter.js, services/web/app/src/Features/Token/TokenRouter.mjs (implemented)
- [x] T028 [P] [US5] Add contract tests for service-origin rate-limits & logging masking — services/web/test/contract/src/ServiceOriginRateLimitTests.mjs, services/web/test/contract/src/LoggingRetentionPIITests.mjs (implemented)
- [x] T029 [P] [US5] Instrument metrics for key lookup & token introspection (histogram/timer) and add CI benchmark jobs — services/web/app/src/Features/Token/TokenController.mjs, ci/benchmarks/ (implemented: metrics timers and CI bench jobs)

---

## Final Phase: Polish & Cross-Cutting Tasks

- [x] T030 Documentation & rollout notes (feature flag `feature.git_auth.local_token_manager`) — docs/tokens.md, FEATURE_BRANCH_NOTES.md (implemented)
- [x] T031 Accessibility audits & frontend E2E screenshots (Playwright) — services/web/test/e2e/playwright/, services/web/test/frontend/\*\* (implemented: `accessibility-ssh-git-tokens.spec.mjs`)
- [ ] T032 Security review & retention policy verification — docs/logging-policy.md, services/web/test/contract/\*\*
- [ ] T033 (BLOCKING) CI gating: add micro-benchmark gating and contract validation to pipeline — .gitlab-ci.yml, ci/benchmarks/
  - Acceptance: The CI pipeline must include gating jobs that fail the merge when benchmark thresholds are exceeded (key-lookup p95 > 50ms or introspect p95 > 100ms). The job must publish artifacts (p50/p95/p99) and be runnable with the documented harness in T0AA. This task is BLOCKING for merges that touch lookup/introspection paths or change related code/config.

---

## Dependencies & Execution Order

- Phase 1 (Setup) → Phase 2 (Foundational) [BLOCKER: T004]
- Foundational must complete before user story work begins
- US1 (P1) and US2 (P1) prioritized for MVP; US3/US4/US5 follow and can be implemented in parallel once foundational tasks complete

## Parallel Execution Examples

- Run `T002` (CI benchmark skeleton), `T003` (lint config), and `T006` (models) in parallel after T005 migration skeleton exists
- Frontend work for US1 (`T013`) and US2 (`T017`) may proceed in parallel against stable API mocks or contract tests

## Implementation Strategy

- MVP: Complete Setup (T001–T004) and Foundational tasks (T005–T009), then deliver US1 (SSH keys) and US2 (Personal Access Tokens) first. Validate each independently and gate CI on unit/contract tests.
- Incremental: Add US3 (introspection) and US4 (git-bridge integration), then add polish tasks (T030–T033).

---

Generated by: speckit task generator — source: .specify/features/example/{plan.md,spec.md}

- [x] T019 Fingerprint → user fast lookup (private API) — GET /internal/api/ssh-keys/:fingerprint
  - Acceptance: returns 200 { userId } or 404, 400 for malformed; protected by `requirePrivateApiAuth()` and service-origin rate limit. Fingerprint format must match `SHA256:<44-char base64>`.

- [x] T020 Short-lived cache + pubsub invalidation — services/web/app/src/lib/cache.js, services/web/lib/pubsub.js, services/git-bridge cache handling
  - Acceptance: TTL default 60s; negative lookup TTL default 5s; invalidation published on revoke/delete.
- [x] T021 Wire `git-bridge` to call introspection fallback & fingerprint lookup — services/git-bridge/src/main/java/\*\*/SSHAuthManager.java (implemented)
  - Acceptance: `git-bridge` uses fast-path lookup and falls back to old behavior gracefully.
- [x] T022 Membership enforcement at RPC handler — git-bridge RPC handlers, membership API contract (implemented: `WebProfileSSHServerMembershipE2ETest.java`)
  - Acceptance: non-member push returns 403; membership contract verified.
- [x] T023 Contract test + E2E for git-bridge auth/membership flow — services/git-bridge/test/contract/\*\*, services/web/test/e2e/ (implemented)

## US4 — Observability, Rate-Limits & Security

- [x] T024 Rate limiting & service-origin controls — services/web/app/src/infrastructure/RateLimiter.js
  - Acceptance: introspect/list endpoints rate-limited per service-origin; token/ssh-key creation per-user limits enforced.
- [x] T024a Define service-origin identification & detection semantics — services/web/app/src/infrastructure/ServiceOrigin.js, docs/ssh-keys.md
  - Acceptance: `X-Service-Origin` header documented as canonical header for internal clients; support mTLS or API keys in deployment; include contract test coverage.
- [x] T025 Contract tests to assert rate-limits & logging masking — services/web/test/contract/rate-limit-service-origin/**, services/web/test/contract/logging/**
- [x] T035 Metrics instrumentation & SLI exports — services/web/app/src/Features/Discovery/SSHKeyLookupController.mjs, services/web/app/src/Features/Token/TokenController.mjs
  - Acceptance: Metrics exported for key lookup (histogram/timer) and token introspection (histogram/timer); CI validates p50/p95/p99 for those endpoints.
- [x] T026 CI benchmarks for SLOs — key-lookup p95 ≤ 50ms; introspect p95 ≤ 100ms — ci/benchmarks/\*
  - Acceptance: CI job artifacts must include p50/p95/p99 for **warm** and **cold** runs. Runner profile: **2 vCPU, 4GB RAM**; benchmark harness and fixed seed dataset must be documented. The CI job name should be `ci/benchmarks/key-lookup` and must gate merges (fail the pipeline if thresholds exceeded).
- [x] T026b Intro micro-benchmark for token introspection — ci/benchmarks/introspection-benchmark/bench.js
  - Acceptance: CI job publishes p50/p95/p99 for local introspection and OAuth2 fallback; includes warm and cold runs, uses runner profile **2 vCPU, 4GB RAM**, and is gated under `ci/benchmarks/introspect` job name.
- [ ] T033 CI micro-benchmark gating & contract validation (parallel) — .gitlab-ci.yml / Jenkins
  - Acceptance: Add explicit gating steps that fail merge when benchmark thresholds (T026/T026b) are exceeded and record artifacts for historical comparison.

## Final — Documentation, Security & Accessibility

- [ ] T027 Documentation & rollout notes — docs/tokens.md, docs/ssh-keys.md, FEATURE_BRANCH_NOTES.md
- [ ] T028 Security review & privacy checklist — docs/logging-policy.md
- [ ] T029 Accessibility & frontend e2e screens — services/web/test/e2e/\*\*
- [x] T030 Add membership OpenAPI contract — specs/001-ssh-git-auth/contracts/membership.openapi.yaml (implemented)
- [ ] T031 Add contract test for membership endpoint — services/git-bridge/test/contract/MembershipContractTest.java
- [ ] T032 Security review checklist & retention policy verification tests — test/contract/logging/\*\*
- [ ] T033 CI micro-benchmark gating & contract validation (parallel) — .gitlab-ci.yml / Jenkins
- [ ] T034 Accessibility tests & frontend e2e (parallel) — services/web/test/e2e/\*\*

## Notes

- `T004` is explicitly blocking: must be completed before token hashing algorithm changes. If `AUTH_TOKEN_HASH_ALGO=argon2id` and argon2 not available at runtime, start-up must fail unless fallback is explicitly configured.
- Create missing docs referenced above and link them to task owners.
- If a task needs to be subdivided, use `TXXXa`, `TXXXb` while preserving the base TID uniqueness.
