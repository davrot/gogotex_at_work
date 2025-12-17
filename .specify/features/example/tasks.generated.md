# Tasks: SSH + HTTPS Git Auth

**Input:** Extracted from: .specify/features/example/plan.md, .specify/features/example/spec.md

## Phase 1: Setup

- [ ] T001 Validate feature docs and plan presence — .specify/features/example/plan.md, .specify/features/example/spec.md
- [ ] T002 [P] Add CI micro-benchmark skeleton and harness — ci/benchmarks/
- [ ] T003 [P] Ensure linting plugin & config present and applied — libraries/eslint-plugin/
- [ ] T004 (BLOCKING) Implement config validation & runtime hash availability check — services/web/app/src/config/validateConfig.mjs, services/web/app/src/config/hashAvailability.mjs
  - Acceptance: Service fails to start when `AUTH_TOKEN_HASH_ALGO=argon2id` and argon2 not supported unless an explicit fallback is configured.

---

## Phase 2: Foundational

- [ ] T005 Setup DB migrations & example fixtures for keys/tokens — services/web/migrations/, services/web/test/fixtures/
- [ ] T006 [P] Verify/implement models: UserSSHKey + PersonalAccessToken — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js
- [ ] T007 [P] Verify/implement PersonalAccessToken manager & introspection logic — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [ ] T008 [P] Verify/implement Token controller & router (create/list/remove/introspect) — services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/Features/Token/TokenRouter.mjs
- [ ] T009 [P] Add structured logging schema & PII retention policy — services/web/lib/log-schemas/auth-events.json, docs/logging-policy.md

---

## Phase 3: User Story 1 — SSH Key Management (US1) (Priority: P1) 🎯 MVP

**Goal:** Allow users to add/remove SSH public keys and display canonical fingerprint.

**Independent Test:** Create a user, POST an SSH key, GET the key list and verify fingerprint format `SHA256:<base64>` and idempotent create behavior.

- [ ] T010 [P] [US1] Ensure SSH Keys CRUD controller & private routes exist and enforce auth — services/web/app/src/Features/User/UserSSHKeysController.mjs
- [ ] T011 [P] [US1] Implement server-side fingerprint computation & validation (SHA256 base64) — services/web/app/src/models/UserSSHKey.js
- [ ] T012 [US1] Add contract tests for SSH keys endpoints — services/web/test/contract/src/SSHKeysContractTest.mjs
- [ ] T013 [US1] Implement & test frontend UI for SSH keys (inline validation & ARIA) — services/web/frontend/js/features/settings/components/SSHKeysPanel.tsx, services/web/test/frontend/features/settings/components/ssh-keys.test.tsx

---

## Phase 4: User Story 2 — Personal Access Tokens (US2) (Priority: P1)

**Goal:** Allow users to create, view (masked), copy plaintext once, and revoke personal access tokens.

**Independent Test:** Create a token via POST and verify returned plaintext token once; subsequent GET shows `accessTokenPartial` only.

- [ ] T014 [P] [US2] Verify Token model includes `hash`, `hashPrefix`, `algorithm`, `scopes`, `expiresAt` — services/web/app/src/models/PersonalAccessToken.js
- [ ] T015 [P] [US2] Unit tests for token lifecycle & `replace=true` semantics — services/web/test/unit/src/Features/Token/Rotation.test.mjs
- [ ] T016 [P] [US2] Integration tests for TokenController create/list/remove endpoints — services/web/test/integration/src/TokenControllerTests.mjs
- [ ] T017 [US2] [P] Frontend: ensure `GitTokensPanel` lists tokens, shows plaintext on create, supports copy-to-clipboard, and handles network errors gracefully — services/web/frontend/js/features/settings/components/GitTokensPanel.tsx, services/web/test/frontend/features/settings/components/git-tokens.test.tsx
- [ ] T018 [US2] Add contract & service-origin rate-limit tests for token creation/listing — services/web/test/contract/src/ServiceOriginRateLimitTests.mjs
  - Contract test: services/web/test/contract/src/HashPrefixFormatContractTest.mjs — assert `hashPrefix` is 8 lowercase hex characters
- [ ] T019 [US2] Reproduce & fix E2E 404 for GET `/internal/api/users/:userId/git-tokens` seen in Playwright run: inspect TokenRouter, AuthenticationController.requireLogin(), router mounting, and server logs during E2E — services/web/app/src/Features/Token/TokenRouter.mjs, services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/router.mjs, services/web/test/e2e/playwright/out/console.log
  - Acceptance: Playwright run (RESET_DB=true BASE_URL=...) shows no 404 for token list and UI shows token list or empty state instead of generic error.

---

## Phase 5: User Story 3 — Token Introspection (US3) (Priority: P2)

**Goal:** Provide token introspection for `git-bridge` and other services.

**Independent Test:** POST `/internal/api/tokens/introspect` with a token and receive `{ active, userId, scopes, expiresAt }`.

- [x] T020 [P] [US3] Verify/implement introspect endpoint & controller tests — services/web/app/src/Features/Token/TokenController.mjs, services/web/test/unit/src/Features/Token/TokenController.test.mjs
- [x] T021 [US3] Add integration & contract tests for introspection shape and error cases — services/web/test/integration/src/TokenIntrospectionTests.mjs, services/web/test/contract/src/TokenIntrospectContractTest.mjs
- [ ] T022 [US3] Add micro-benchmark for introspection latency (CI) and gate p95 ≤ 100ms — ci/benchmarks/introspection-benchmark/

---

## Phase 6: User Story 4 — Git Auth Integration & Membership (US4) (Priority: P2)

**Goal:** Map SSH fingerprint → userId quickly and enforce project membership during git RPCs.

**Independent Test:** Simulate fingerprint lookup → obtain userId; simulate RPC with known user but not a member → observe 403 and audit log.

- [ ] T023 [P] [US4] Ensure private fingerprint lookup API exists and is contract-covered — GET /internal/api/ssh-keys/:fingerprint, services/web/test/contract/src/SSHKeyLookupContractTest.mjs
- [ ] T024 [US4] Short-lived cache and pubsub invalidation for fingerprint lookup — services/web/app/src/lib/cache.js, services/web/lib/pubsub.js
- [x] T025 [US4] Wire `git-bridge` to call fingerprint lookup and introspection fallback path — services/git-bridge/src/main/java/**/SSHAuthManager.java, services/git-bridge/test/contract/**
- [ ] T025a Verify git-bridge E2E observes auth.http_attempt success path when valid tokens are used — scripts/e2e/git-https-acceptance.sh, services/web/test/e2e/playwright
- [ ] T026a [US4] Membership enforcement tests at RPC handler (integration) — services/git-bridge/test/integration/**

---

## Phase 7: Cross-cutting — Observability, Rate-Limits & Security (US5)

**Goal:** Structured logs, rate-limits (service-origin + per-user), SLOs, and audits for token/key events.

**Independent Test:** Contract tests assert rate-limits (429) per service-origin; logs contain prescribed fields and `hashPrefix` instead of full hashes.

- [ ] T027 [P] [US5] Ensure rate-limiter applied to introspect/list and create endpoints — services/web/app/src/infrastructure/RateLimiter.js, services/web/app/src/Features/Token/TokenRouter.mjs
- [ ] T028 [P] [US5] Add contract tests for service-origin rate-limits & logging masking — services/web/test/contract/src/ServiceOriginRateLimitTests.mjs, services/web/test/contract/src/LoggingRetentionPIITests.mjs
- [ ] T029 [P] [US5] Instrument metrics for key lookup & token introspection (histogram/timer) and add CI benchmark jobs — services/web/app/src/Features/Token/TokenController.mjs, ci/benchmarks/

---

## Final Phase: Polish & Cross-Cutting Tasks

- [ ] T030 Documentation & rollout notes (feature flag `feature.git_auth.local_token_manager`) — docs/tokens.md, FEATURE_BRANCH_NOTES.md
- [ ] T031 Accessibility audits & frontend E2E screenshots (Playwright) — services/web/test/e2e/playwright/, services/web/test/frontend/\*\*
- [ ] T032 Security review & retention policy verification — docs/logging-policy.md, services/web/test/contract/\*\*
- [ ] T033 CI gating: add micro-benchmark gating and contract validation to pipeline — .gitlab-ci.yml, ci/benchmarks/

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
