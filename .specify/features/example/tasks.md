# Tasks: SSH + HTTPS Git Auth (Consolidated)

## Phase 1 — Setup

- [x] T001 Validate project structure, spec and plan presence — .specify/features/example/plan.md, .specify/features/example/spec.md
- [x] T002 Add CI micro-benchmark skeleton — ci/benchmarks/, .gitlab-ci.yml
- [x] T003 Ensure linting plugin & config present — libraries/eslint-plugin/index.js
- [ ] T004 Config validation & hash availability checks — services/web/app/src/config/validateConfig.mjs, services/web/app/src/config/hashAvailability.mjs

## Phase 2 — Foundational

- [ ] T005 DB migrations & example fixtures for keys/tokens — services/web/migrations/
- [x] T006 Models: UserSSHKey + PersonalAccessToken — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js
- [x] T007 Token manager & introspection logic implemented — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [x] T008 Token controller & introspect endpoint implemented — services/web/app/src/Features/Token/TokenController.mjs
- [ ] T009 Structured logging + PII retention policy (spec + tests) — services/web/lib/log-schemas/auth-events.json, docs/logging-policy.md

## US1 — SSH Keys (P1)

- [ ] T010 SSH Keys CRUD controller & routes — services/web/app/src/Features/User/UserSSHKeysController.mjs (privateAPI)
- [ ] T011 Server-side fingerprint compute & validation — services/web/app/src/Features/User/UserSSHKeysController.mjs
- [ ] T012 Contract tests for SSH keys (create/list/delete/duplicates/malformed) — services/web/test/contract/ssh-keys/\*
- [ ] T013 Frontend UI for SSH keys — services/web/frontend/js/features/settings/components/SSHKeysPanel.tsx

## US2 — Personal Access Tokens (P2)

- [x] T014 Token model & hashPrefix — services/web/app/src/models/PersonalAccessToken.js
- [x] T015 Token manager lifecycle & rotation — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [x] T016 Token controller uses introspect endpoint — services/web/app/src/Features/Token/TokenController.mjs
- [ ] T017 Unit/integration tests for token lifecycle — services/web/test/unit/**, services/web/test/integration/**
- [ ] T018 Migration/backfill scripts for expiry & algorithm metadata — services/web/migrations/

## US3 — Git Auth Integration (P3)

- [ ] T019 Fingerprint→user fast lookup (Private API) — services/web/app/src/Features/Discovery/SSHKeyLookupController.mjs (GET /internal/api/ssh-keys/:fingerprint)
- [ ] T019a Add contract test for SSH fingerprint lookup — services/web/test/contract/src/SSHKeyLookupContractTest.mjs
- [ ] T020 Short-lived cache w/ pubsub invalidation (web & git-bridge) — services/web/lib/pubsub.js, services/web/app/src/lib/cache.js, services/git-bridge/\*\*
- [ ] T021 Configure `git-bridge` to call introspection fallback & fingerprint lookup — services/git-bridge/src/main/java/\*\*/SSHAuthManager.java
- [ ] T022 Membership enforcement at RPC handler & membership API contract tests — services/git-bridge/src/main/java/\*\*/WLGitServlet.java, specs/001-ssh-git-auth/contracts/membership.openapi.yaml
- [ ] T023 Contract test + integration E2E for git-bridge flow (auth + membership failure path) — services/git-bridge/test/contract/\*\*, services/web/test/e2e/

## US4 — Observability, Rate-Limits & Security (P4)

- [ ] T024 Rate limiting & service-origin controls for introspection/lookup endpoints — services/web/app/src/infrastructure/RateLimiter.js, services/web/app/src/Features/Token/TokenController.mjs
- [ ] T025 Add contract tests to assert rate limiting & logging masking — services/web/test/contract/rate-limit-service-origin/**, services/web/test/contract/logging/**
- [ ] T026 CI benchmarks: key lookup p95 ≤ 50ms; introspect p95 ≤ 100ms — ci/benchmarks/key-lookup-benchmark/, ci/benchmarks/introspection-benchmark/

## Final — Polish

- [ ] T027 Documentation & rollout notes — docs/tokens.md, docs/ssh-keys.md, FEATURE_BRANCH_NOTES.md
- [ ] T028 Security review + privacy checklist — docs/logging-policy.md
- [ ] T029 Accessibility & frontend e2e screens — services/web/test/e2e/\*, services/web/frontend/test/\*\*

## New Contract Tasks

- [ ] T030 Add membership OpenAPI contract — specs/001-ssh-git-auth/contracts/membership.openapi.yaml
- [ ] T031 Add contract test for membership endpoint in `git-bridge` (MembershipContractTest.java)

## Notes

- Ensure private APIs use `AuthenticationController.requirePrivateApiAuth()` and service-origin rate-limiting for introspection/lookup.
- All tasks that add endpoints MUST include unit, integration, and contract test entries as documented in constitution.

# Tasks for SSH + HTTPS Git Auth (Example)

## Phase 1: Setup (Shared Infrastructure)

  
- [x] T002 [P] Add CI benchmarks skeleton and micro-benchmark harness — ci/benchmarks/, .gitlab-ci.yml
- [x] T003 [P] Add/enable minimal eslint plugin to satisfy lint and enforce rules — libraries/eslint-plugin/index.js
- [ ] T004 [P] Add startup config validation & hash availability checks — services/web/app/src/config/validateConfig.mjs, services/web/app/src/config/hashAvailability.mjs

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T005 Setup DB migrations and sample dataset for SSH keys & tokens — services/web/migrations/, services/web/test/fixtures/
- [x] T006 [P] Implement models: UserSSHKey + PersonalAccessToken — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js
- [x] T007 [P] Implement token manager and introspection logic (argon2/bcrypt fallback) — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [x] T008 [P] Implement token controller endpoints (create/list/remove/introspect) — services/web/app/src/Features/Token/TokenController.mjs
- [ ] T009 [P] Add structured logging schema + retention & PII masking docs — services/web/lib/log-schemas/auth-events.json, docs/logging-policy.md

---

## Phase 3: User Story 1 - SSH Key Management (Priority: P1)

**Goal**: Add/remove SSH keys and show fingerprint in UI.

**Independent Test**: POST /internal/api/users/:userId/ssh-keys returns 201/200; GET returns fingerprint field; duplicate key insertion is idempotent.

- [ ] T010 [US1] Implement SSH keys controller & routes — services/web/app/src/Features/User/UserSSHKeysController.mjs; wire into router.mjs (privateApiRouter)
- [ ] T011 [US1] Add server-side fingerprint computation + validation — services/web/app/src/Features/User/UserSSHKeysController.mjs (use existing helper where present), services/web/app/src/models/UserSSHKey.js
- [ ] T012 [US1] Add contract tests for SSH key endpoints — services/web/test/contract/ssh-keys/\*
- [ ] T013 [US1] Add duplicate-key idempotency & malformed-key tests — services/web/test/contract/ssh-keys/duplicates.test.mjs, services/web/test/contract/ssh-keys/malformed.test.mjs
- [ ] T014 [US1] Add frontend components and wiring for SSH keys — services/web/frontend/js/features/settings/components/SSHKeysPanel.tsx (ensure forms call internal endpoints)

---

## Phase 4: User Story 2 - Personal Access Tokens (Priority: P2)

**Goal**: Create, list (masked), revoke tokens; store only hashes; return plaintext once at creation.

**Independent Test**: POST returns plaintext token once; GET lists token with hashPrefix only; DELETE revokes and introspection responds inactive.

- [x] T015 [US2] Ensure PersonalAccessToken model & hash prefix persisted — services/web/app/src/models/PersonalAccessToken.js
- [x] T016 [US2] Ensure token manager handles create/list/revoke + `replace=true` semantics — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [x] T017 [US2] Ensure token endpoints exist & introspect accepts `POST /internal/api/tokens/introspect` — services/web/app/src/Features/Token/TokenController.mjs, router.mjs
- [ ] T018 [US2] Add unit & integration tests for token lifecycle (create, list masked, revoke, introspect) — services/web/test/unit/**, services/web/test/integration/**
- [ ] T019 [US2] Add migration/backfill for token expiry/hash metadata — services/web/migrations/backfill-token-expiry.js, services/web/migrations/rewrite-token-hashing.js

---

## Phase 5: User Story 3 - Git Auth Integration (Priority: P3)

**Goal**: Map SSH key fingerprint → userId (fast lookup) and `git-bridge` uses introspection/fingerprint+membership check for repo-level authorization.

**Independent Test**: Fingerprint lookup returns userId; `git-bridge` denies pushes for non-members (403) and introspection validates tokens.

- [ ] T020 [US3] Add fingerprint→user lookup endpoint & contract — services/web/app/src/Features/Discovery/SSHKeyLookupController.mjs (endpoint: GET /internal/api/ssh-keys/:fingerprint)
- [ ] T021 [US3] Add short-lived cache w/ TTL and pubsub invalidation for fingerprint lookups in web and git-bridge — services/web/lib/pubsub.js, services/web/app/src/lib/cache.js, services/git-bridge/src/main/java/\*\*/cacheSubscriber
- [ ] T022 [US3] Wire `git-bridge` to call introspection fallback & integrate fingerprint lookup (authorise by token or SSH key) — services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/auth/SSHAuthManager.java, services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/git/handler/WLReceivePackFactory.java
- [ ] T023 [US3] Add membership check at RPC handler (git-bridge) using membership API — services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/git/handler/WLReceivePackFactory.java; ensure `MEMBERSHIP_API_BASE_URL` config is respected
- [ ] T024 [US3] Add unit & contract tests for `git-bridge` membership check & auth mapping — services/git-bridge/src/test/\*\*, contracts/WebProfileContractTest.java
- [ ] T025 [US3] Add integration E2E test: create token/key in web → attempt clone/push with git-bridge → verify 403 for unauthorized, success for authorized — services/web/test/e2e/, services/git-bridge/test/integration/

---

## Phase 6: User Story 4 - Observability, Rate-Limits & Security (Priority: P4)

**Goal**: Emit structured logs for token/key events, enforce rate-limits, document hashing & migration policy.

**Independent Test**: Structured log emitted for create/delete/use events; rate-limit enforces 429 under high request rates; config startup validates hash algorithm availability.

- [ ] T026 [US5] Add structured JSON logging schema & emit events — services/web/lib/log-schemas/auth-events.json, services/web/app/src/lib/logger.js
- [ ] T027 [US5] Implement per-user & service-origin rate-limits for relevant endpoints — services/web/app/src/infrastructure/RateLimiter.js, services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/Features/User/UserSSHKeysController.mjs
- [ ] T028 [US5] Add rate limiting contract tests (service-origin & per-user) — services/web/test/contract/rate-limit-service-origin/\*\*
- [ ] T029 [US5] CI benchmark introspection and SLOs — ci/benchmarks/introspection-benchmark/, .gitlab-ci.yml
- [ ] T030 [US5] Document migration/backfill & rollout notes — docs/tokens.md, docs/ssh-keys.md, FEATURE_BRANCH_NOTES.md

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Update docs and feature notes — docs/ssh-keys.md, docs/tokens.md, FEATURE_BRANCH_NOTES.md
- [ ] T032 [P] Add security review checklist and retention policy verification tests — docs/logging-policy.md, services/web/test/contract/logging/
- [ ] T033 [P] CI: Add micro-benchmark gating (key lookup p95 ≤ 50ms, introspect p95 ≤ 100ms) and contract validations — .gitlab-ci.yml, ci/benchmarks/
- [ ] T034 [P] Add accessibility tests & frontend e2e screens for tokens/ssh-keys flow — services/web/test/e2e/\*.mjs, services/web/frontend/test/\*\*

---

## Dependencies & Execution Order

- **Phase 1** must complete before Phase 2.
- **Phase 2** (Foundational) must complete before User Story phases (Phase 3+).
- **Parallelism**: tasks marked [P] can be run in parallel (different files, no dependency on incomplete tasks). All user story phases may proceed in parallel after Foundational tasks complete, but prefer P1 → P2 → P3 ordering for MVP.

## User Story Task Counts & Summary

- Total tasks: 34
- Per story:
  - US1 (SSH keys): 6 tasks (T010–T014)
  - US2 (Tokens): 5 tasks (T015–T019)
  - US3 (Git auth + bridge): 6 tasks (T020–T025)
  - US5 (Observability/Rate-limits): 5 tasks (T026–T030)
  - Setup/Foundational/Polish: 12 tasks (T001–T009, T031–T034)

## Parallel Opportunities

- Phase 1 tasks T002 and T003 can run in parallel with T006–T008 (models & controllers).
- Foundational T005, T006, T007, T008 are parallelizable if they touch different files.
- After foundational: US1, US2, US3, US5 phases can progress concurrently by different teams.

## Independent Test Criteria (per story)

- US1: Contract tests pass for SSH key CRUD; frontend shows fingerprint; duplicate behavior validated.
- US2: Token lifecycle tests pass (create/list/revoke/introspect); mask & hash storage validated via DB save; E2E create→introspect.
- US3: `git-bridge` rejects unauthorized pushes (403); fingerprint lookup returns userId; membership endpoint returns 200 for members.
- US5: Logs emitted with minimal PII; rate-limit tests return 429 when exceeded; CI benchmarks meet SLOs.

## MVP Recommendation

- MVP scope: Phase 1 + Phase 2 + US1 — allow users to add SSH keys and verify fingerprint (minimal but immediate value for `git-bridge` security integration).

# Tasks for SSH + HTTPS Git Auth (Example)

## Phase 1: Setup (Shared Infrastructure)

  
- [ ] T002 [P] Add CI harness skeleton and micro-benchmark framework — ci/benchmarks/, .gitlab-ci.yml
- [ ] T003 [P] Configure linting, formatting, and config validation checks — libraries/eslint-plugin/, services/web/app/src/config/validateConfig.mjs

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Setup database migrations and sample dataset — services/web/migrations/, ci/benchmarks/
- [ ] T005 [P] Implement core models and configuration validation — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js, services/web/app/src/config/validateConfig.mjs
- [ ] T006 Implement basic auth infrastructure & introspection wiring — services/git-bridge/src/main/java/**/Oauth2Filter.java, services/git-bridge/src/main/java/**/SSHAuthManager.java

---

## Phase 3: User Story 1 - SSH Key Management (Priority P1)

**Goal**: Users can add/remove SSH keys and view fingerprint.

**Independent Test**: POST adds key (201/200) and GET shows fingerprint field.

- [ ] T007 [US1] Create SSH key model and storage — services/web/app/src/models/UserSSHKey.js
- [ ] T008 [US1] Implement SSH keys endpoints (POST/GET/DELETE) — services/web/app/src/Features/User/UserSSHKeysController.mjs
- [ ] T009 [US1] Add contract tests for SSH key add/list/remove — test/contract/ssh-keys/\*\*
- [ ] T010 [US1] Add duplicate key idempotency and validation tests — test/contract/ssh-keys/duplicates.test.js

---

## Phase 4: User Story 2 - Personal Access Tokens (Priority P2)

**Goal**: Issue, list (masked), and revoke personal access tokens (PA tokens).

**Independent Test**: POST returns one-time plaintext token; subsequent GET shows masked token.

- [ ] T011 [US2] Implement PersonalAccessToken model and hashing metadata — services/web/app/src/models/PersonalAccessToken.js
- [ ] T012 [US2] Implement token manager & create/revoke logic — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs
- [ ] T013 [US2] Implement token endpoints and introspection — services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/router.mjs
- [ ] T014 [US2] Add migration/backfill for token expiry & hashing metadata — services/web/migrations/backfill-token-expiry.js, services/web/migrations/rewrite-token-hashing.js
- [ ] T015 [US2] Add unit and integration tests for token lifecycle — test/unit/**, test/integration/**

---

## Phase 5: User Story 3 - Git Auth Integration (Priority P3)

**Goal**: `git-bridge` uses SSH key fingerprint and token introspection for auth and denies non-members.

**Independent Test**: Public key maps to userId; membership check returns 403 for non-members.

- [ ] T016 [US3] Implement key→user lookup and cache with TTL & invalidation hooks — services/git-bridge/src/main/java/\*\*/SSHAuthManager.java, services/web/lib/pubsub.js
- [ ] T017 [US3] Add membership check at git RPC handlers — services/git-bridge/src/main/java/\*\*/WLGitServlet.java
- [ ] T018 [US3] Implement scope evaluation for RP actions — services/git-bridge/src/main/java/\*\*/ScopeEvaluator.java; add unit/contract tests
- [ ] T019 [US3] Add cache invalidation API & integration tests — services/web/app/src/routes/cacheInvalidate.mjs, test/integration/cache-invalidation/\*\*

---

## Phase 6: User Story 4 - V0 Snapshot Adapter & Parity Tests (Priority P4)

**Goal**: Implement V0ReplacementAdapter with parity tests for snapshot behavior if needed.

- [ ] T020 [US4] Implement `V0ReplacementAdapter` methods & config — services/git-bridge/src/main/java/\*\*/V0ReplacementAdapter.java
- [ ] T021 [US4] Add unit & parity tests for V0 adapter — test/unit/**, test/contract/**

---

## Phase 7: User Story 5 - Observability, Rate-Limits & Security (Priority P5)

**Goal**: Structured logs, rate limiting and observability for tokens/keys.

**Independent Test**: Structured log entries for token/key events; rate-limit triggers 429 under load.

- [ ] T022 [US5] Add structured logging schema & emit events (hashPrefix only) — services/web/lib/log-schemas/auth-events.json, services/web/lib/logger.js
- [ ] T023 [US5] Implement rate limiting & service-origin controls — services/web/app/src/middleware/rateLimiter.js, test/contract/rate-limit-service-origin/\*\*
- [ ] T024 [US5] CI micro-benchmarks for key lookup & introspection — ci/benchmarks/key-lookup-benchmark/bench.js, ci/benchmarks/introspection-benchmark/bench.js

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Update docs and rollout notes — docs/ssh-keys.md, docs/tokens.md, FEATURE_BRANCH_NOTES.md
- [ ] T026 [P] Add CI gating, contract checks, and SLOs — .gitlab-ci.yml, ci/benchmarks/\*
- [ ] T027 [P] Add security review, migration strategy docs, retention & PII handling — docs/logging-policy.md, FEATURE_BRANCH_NOTES.md

---

## Dependencies & Execution Order

- Foundational (T004-T006) must complete before User Stories can start.
- Work can proceed in parallel across independent stories where denoted [P].
- MVP: Phase 1 + Phase 2 + User Story 1 (T001-T010).

---

Checklist:

- [ ] Implementation
- [ ] Tests
- [ ] Documentation

# Tasks for SSH + HTTPS Git Auth (Example)

  

- [ ] T002 [US2] Implement `PersonalAccessToken` model + manager — services/web/app/src/models/PersonalAccessToken.js, services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs. Acceptance: create/list/revoke helpers; tokens hashed with `argon2id` (or explicit `bcrypt` fallback); `hashPrefix` persisted; store `hashAlgorithm` in token metadata; include migration/backfill task to re-hash or re-issue tokens as needed.

- [ ] T003 [US2] Implement token controller + introspect endpoint — services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/router.mjs. Acceptance: `POST /internal/api/tokens/introspect` returns `{ active, userId, scopes, expiresAt }` and p95 ≤ 100ms.

- [ ] T004 [US1] Ensure SSH keys endpoint parity & key→user mapping — services/web/app/src/Features/User/UserSSHKeysController.mjs, services/web/app/src/models/UserSSHKey.js. Acceptance: `GET /internal/api/users/:userId/ssh-keys` returns top-level JSON array with canonical fields.

- [ ] T005 [US3] Wire `git-bridge` auth flows to introspection & key lookup — services/git-bridge/src/main/java/**/Oauth2Filter.java, services/git-bridge/src/main/java/**/SSHAuthManager.java. Acceptance: fallback to local introspect when OAuth2 unavailable.

- [ ] T006 [US3] Add membership check in git RPC handler — services/git-bridge/src/main/java/\*\*/WLGitServlet.java (or git handlers). Acceptance: deny upload/receive-pack with 403 when not a member.
- [ ] T006a [US3] Repo path -> projectId mapping unit tests — test/unit/\*\*. Acceptance: unit tests assert canonical mapping `/repo/{owner}/{slug}.git` -> `{owner}/{slug}` and cover edge-case path segments, percent encoding, and leading/trailing slashes.
- [ ] T007 [US1] Frontend: token & SSH key UI [P] — services/web/frontend/js/features/\*\* and ai/components/ssh-keys/SSHKeysPanel.tsx. Acceptance: list/mask tokens, create (show once), revoke; add SSH keys UI.

- [ ] T008 [US2] Tests: unit, contract, E2E — test/unit/**, test/contract/**, test/e2e/\*\*. Acceptance: unit tests for managers, contract tests for introspect, E2E create token/key → simulated clone.
- [ ] T008a [US1] Duplicate SSH key tests — test/contract/\*\*. Acceptance: contract tests assert idempotent behavior for same `public_key` insertion returns 200 with existing resource; cross-user duplicate insertion returns 409 Conflict.
- [ ] T009 [US5] Observability & audit logging — services/web/lib/log-schemas/auth-events.json (new), services/web/lib/logger.js. Acceptance: structured logs emitted for create/delete/use with required fields; add `T009b` for retention and PII masking policy and tests that assert `hashPrefix` is logged not full hash.

- [ ] T009b [US5] Logging retention and PII policy — services/web/lib/log-schemas/auth-events.json, docs/logging-policy.md, test/contract/logging/\*\*. Acceptance: retention policy documented, PII masking & redaction rules specified; tests ensure only `hashPrefix` emitted for tokens.

- [ ] T010 [US5] Rate limiting & abuse protections [P] — services/web/app/src/middleware/rateLimiter.js. Acceptance: per-user rate limits on token and SSH key creation endpoints; support service-origin rate limits for introspection/listing endpoints and include configuration knobs.

- [ ] T010b [US5] Service-origin rate-limit tests & config — test/contract/rate-limit-service-origin/\*\*, docs/rate-limit.md. Acceptance: contract tests assert 60 req/min per service-origin for introspection and listing; document how service-origin is identified (client ID / API key / token fingerprint) and how to configure it.

- [ ] T011 [US4] Documentation & rollout notes — docs/ssh-keys.md, docs/tokens.md, FEATURE_BRANCH_NOTES.md. Acceptance: include hashing algorithm and migration notes; add service-origin identification docs and CI benchmark runner profile and harness documentation.

- [ ] T011b [US5] Service-origin identification & docs — docs/identifying-service-origin.md, test/contract/service-origin/\*\*. Acceptance: document how service-origin is identified (client ID/API key/token fingerprint) and include contract tests asserting identification is accepted and used.

- [ ] T012 [CI] CI and contract verification — .gitlab-ci.yml (or equivalent). Acceptance: run unit, contract, integration, E2E tests and include micro-benchmark job (T013) that gates merges.

- [ ] T013 [CI] CI micro-benchmark — ci/benchmarks/key-lookup-benchmark/bench.js. Description: harness to measure p50/p95/p99 for SSH key fingerprint → user lookup; CI fails if p95 > 50ms. Acceptance: job artifacts contain p50/p95/p99; runs on runner profile 2 vCPU/4GB RAM; uses synthetic dataset (1k-10k keys across ~200 users); includes warm-cache and cold-cache runs; CI gate fails on p95 > 50ms.

- [ ] T013b [CI] CI micro-benchmark — ci/benchmarks/introspection-benchmark/bench.js. Description: harness to measure p50/p95/p99 for token introspection (local introspection & OAuth2 fallback), measured across representative load; CI fails if p95 > 100ms. Acceptance: job artifacts contain p50/p95/p99 for both local and OAuth2 fallback; runs on runner profile 2 vCPU/4GB RAM; includes warm-cached and cold-cached runs; CI gate fails on p95 > 100ms.

- [ ] T014 [US4] Implement `V0ReplacementAdapter` and parity tests — services/git-bridge/src/main/java/**/V0ReplacementAdapter.java, test/**.

- [ ] T015 [US2] Migration/backfill: token expiry backfill — services/web/migrations/backfill-token-expiry.js. Acceptance: CI dry-run reports affected rows; migration assigns `expiresAt` default 90d to tokens without expiry.

- [ ] T016 [US3] Cache invalidation API & pubsub — services/web/app/src/routes/cacheInvalidate.mjs, services/web/lib/pubsub.js, services/git-bridge/src/main/java/\*\*/cacheSubscriber. Acceptance: `POST /internal/api/cache/invalidate` implemented and `auth.cache.invalidate` published on revoke/delete events.

- [ ] T016b [US3] Cache invalidation integration tests — test/integration/cache-invalidation/\*\*. Acceptance: publish `auth.cache.invalidate` and assert remote service instances purge caches within TTL; test `POST /internal/api/cache/invalidate` immediate invalidation.

- [ ] T018 [US3] Scope evaluation & tests — services/git-bridge/src/main/java/**/ScopeEvaluator.java, test/unit/**, test/contract/\*\*. Acceptance: implement scope parsing and evaluation (`repo:read`, `repo:write`, `repo:admin`, optional resource-id), unit tests for mapping to allowed RPCs, and contract tests covering negative cases.

- [ ] T012 [CI] CI and contract verification — .gitlab-ci.yml (or equivalent). Acceptance: run unit, contract, integration, E2E tests and include micro-benchmark job (T013) that gates merges.

- [ ] T013 [CI] CI micro-benchmark — ci/benchmarks/key-lookup-benchmark/bench.js. Description: harness to measure p50/p95/p99 for SSH key fingerprint → user lookup; CI fails if p95 > 50ms. Acceptance: job artifacts contain p50/p95/p99; runs on runner profile 2 vCPU/4GB RAM; uses synthetic dataset (1k-10k keys across ~200 users); includes warm-cache and cold-cache runs; CI gate fails on p95 > 50ms.

- [ ] T014 [US4] Implement `V0ReplacementAdapter` and parity tests — services/git-bridge/src/main/java/**/V0ReplacementAdapter.java, test/**. Acceptance: methods `getDoc`, `getSavedVers`, `getSnapshot`, `pushSnapshot` implemented and parity tests added.

- [ ] T015 [US2] Migration/backfill: token expiry backfill — services/web/migrations/backfill-token-expiry.js. Acceptance: CI dry-run reports affected rows; migration assigns `expiresAt` default 90d to tokens without expiry.

- [ ] T016 [US3] Cache invalidation API & pubsub — services/web/app/src/routes/cacheInvalidate.mjs, services/web/lib/pubsub.js, services/git-bridge/src/main/java/\*\*/cacheSubscriber. Acceptance: `POST /internal/api/cache/invalidate` implemented and `auth.cache.invalidate` published on revoke/delete events.

Checklist:

- [ ] Implementation
- [ ] Tests
- [ ] Documentation

# Tasks for SSH + HTTPS Git Auth (Example)

  

- [x] T002 [US2] Implement `PersonalAccessToken` model + manager — services/web/app/src/models/PersonalAccessToken.js, services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs. Acceptance: create/list/revoke helpers; tokens hashed with `argon2id` (or `bcrypt` fallback); `hashPrefix` persisted.

- [x] T002a [US2] Dependency evaluation: confirm availability of `@overleaf/access-token-encryptor` or plan vendored fallback — CI check and decision recorded in `FEATURE_BRANCH_NOTES.md`. Acceptance: decision recorded and task created for fallback if needed.

- [ ] T002b [US2] Hashing fallback & migration decision + backfill tasks — services/web/migrations/rewrite-token-hashing.js, services/web/app/src/config/validateConfig.mjs. Acceptance: document `AUTH_TOKEN_HASH_ALGO` detection semantics and runtime behavior; service MUST fail-fast when `argon2id` is configured but unavailable unless `bcrypt` fallback is explicitly set; store `hashAlgorithm` in token metadata; provide `services/web/migrations/rewrite-token-hashing.js` for migration/backfill and a documented re-hash/rotation strategy; include CI tests that validate startup behavior and migration logic.
  - Implementation note: `services/web/app/src/config/hashAvailability.mjs` added to validate runtime availability; ensure CI includes unit tests for this module (see `services/web/test/unit/src/Config/hashAvailability.test.mjs`).

- [ ] T002c [US2] Token rotation: `replace=true` semantics & tests — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs, services/web/test/unit/src/Features/Token/Rotation.test.mjs. Acceptance: `replace=true` causes previous token(s) for the same label to be revoked immediately; introspection returns `active:false` for revoked tokens; add unit + integration tests.

- [x] T003 [US2] Implement token controller + introspect endpoint — services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/router.mjs. Acceptance: `POST /internal/api/tokens/introspect` returns `{ active, userId, scopes, expiresAt }` and p95 ≤ 100ms.

- [x] T004 [US1] Ensure SSH keys endpoint parity & key→user mapping — services/web/app/src/Features/User/UserSSHKeysController.mjs, services/web/app/src/models/UserSSHKey.js. Acceptance: `GET /internal/api/users/:userId/ssh-keys` returns top-level JSON array with canonical fields.

- [x] T005 [US3] Wire `git-bridge` auth flows to introspection & key lookup — services/git-bridge/src/main/java/**/Oauth2Filter.java, services/git-bridge/src/main/java/**/SSHAuthManager.java. Acceptance: fallback to local introspect when OAuth2 unavailable.

- [x] T006 [US3] Add membership check in git RPC handler — services/git-bridge/src/main/java/\*\*/WLGitServlet.java (or git handlers). Acceptance: deny upload/receive-pack with 403 when not a member.
- [ ] T006a [US3] Repo path -> projectId mapping unit tests — test/unit/\*\*. Acceptance: unit tests assert canonical mapping `/repo/{owner}/{slug}.git` -> `{owner}/{slug}` and cover edge-case path segments, percent encoding, and leading/trailing slashes.
- [ ] T007 [US1] Frontend: token & SSH key UI [P] — services/web/frontend/js/features/\*\* and ai/components/ssh-keys/SSHKeysPanel.tsx. Acceptance: list/mask tokens, create (show once), revoke; add SSH keys UI; inclusion of accessibility (WCAG AA) tests and UX verification.

- [ ] T008 [US2] Tests: unit, contract, E2E — test/unit/**, test/contract/**, test/e2e/\*\*. Acceptance: unit tests for managers, contract tests for introspect, E2E create token/key → simulated clone.
- [ ] T008a [US1] Duplicate SSH key tests — test/contract/\*\*. Acceptance: contract tests assert idempotent behavior for same `public_key` insertion returns 200 with existing resource; cross-user duplicate insertion returns 409 Conflict.
- [ ] T009 [US5] Observability & audit logging — services/web/lib/log-schemas/auth-events.json (new), services/web/lib/logger.js. Acceptance: structured logs emitted for create/delete/use with required fields; add `T009b` for retention and PII masking policy and tests that assert `hashPrefix` is logged not full hash.

- [ ] T009b [US5] Logging retention and PII policy — services/web/lib/log-schemas/auth-events.json, docs/logging-policy.md, test/contract/logging/\*\*. Acceptance: retention policy documented, PII masking & redaction rules specified; tests ensure only `hashPrefix` emitted for tokens.

- [ ] T010 [US5] Rate limiting & abuse protections [P] — services/web/app/src/middleware/rateLimiter.js. Acceptance: per-user rate limits on token and SSH key creation endpoints; support service-origin rate limits for introspection/listing endpoints and include configuration knobs.

- [ ] T010b [US5] Service-origin rate-limit tests & config — test/contract/rate-limit-service-origin/\*\*, docs/rate-limit.md. Acceptance: contract tests assert 60 req/min per service-origin for introspection and listing; document how service-origin is identified (client ID / API key / token fingerprint) and how to configure it.

- [ ] T020 [US5] Rate-limit tests & documentation — test/contract/**, test/integration/**, FEATURE_BRANCH_NOTES.md. Acceptance: add contract tests that assert numeric limits (token creation: 5/min user, SSH key creation: 5/min user) and document tuning knobs in `FEATURE_BRANCH_NOTES.md`.

- [ ] T011 [US4] Documentation & rollout notes — docs/ssh-keys.md, docs/tokens.md, FEATURE_BRANCH_NOTES.md. Acceptance: include hashing algorithm and migration notes; add service-origin identification docs and CI benchmark runner profile and harness documentation.

- [ ] T011b [US5] Service-origin identification & docs — docs/identifying-service-origin.md, test/contract/service-origin/\*\*. Acceptance: document how service-origin is identified (client ID/API key/token fingerprint) and include contract tests asserting identification is accepted and used.

- [ ] T012 [CI] CI and contract verification — .gitlab-ci.yml (or equivalent). Acceptance: run unit, contract, integration, E2E tests and include micro-benchmark job (T013) that gates merges.

- [ ] T013 [CI] CI micro-benchmark — ci/benchmarks/key-lookup-benchmark/bench.js. Description: harness to measure p50/p95/p99 for SSH key fingerprint → user lookup; CI fails if p95 > 50ms. Acceptance: job artifacts contain p50/p95/p99; runs on runner profile 2 vCPU/4GB RAM; uses synthetic dataset (1k-10k keys across ~200 users); includes warm-cache and cold-cache runs; CI gate fails on p95 > 50ms.

- [ ] T013b [CI] CI micro-benchmark — ci/benchmarks/introspection-benchmark/bench.js. Description: harness to measure p50/p95/p99 for token introspection (local introspection & OAuth2 fallback), measured across representative load; CI fails if p95 > 100ms. Acceptance: job artifacts contain p50/p95/p99 for both local and OAuth2 fallback; runs on runner profile 2 vCPU/4GB RAM; includes warm-cached and cold-cached runs; CI gate fails on p95 > 100ms.

- [ ] T014 [US4] Implement `V0ReplacementAdapter` and parity tests — services/git-bridge/src/main/java/**/V0ReplacementAdapter.java, test/**.
  - T014.a: Implement adapter methods (`getDoc`, `getSavedVers`, `getSnapshot`, `pushSnapshot`) — services/git-bridge/src/main/java/\*\*/V0ReplacementAdapter.java. Acceptance: methods implemented with configurable HTTP/SDK endpoints and documented behavior.

  - T014.b: Unit tests — test/unit/\*\* for `V0ReplacementAdapter` covering happy and error paths.

  - T014.c: Parity/contract tests — test/contract/\*\* ensuring parity with legacy V0 snapshots.

  - T014.d: Wire-in & feature flag rollout — services/git-bridge/src/main/java/\*\*/legacyCallSites.java, config/feature-flags.yml. Acceptance: adapter wired under `feature.v0_adapter` flag and rollback plan documented.

  Note: if `V0ReplacementAdapter` surface area grows beyond the scope of this auth feature, move the implementation and detailed tasks to a dedicated feature (e.g., `.specify/features/v0-replacement`) and reference it from this tasks list.

- [ ] T015 [US2] Migration/backfill: token expiry backfill — services/web/migrations/backfill-token-expiry.js. Acceptance: CI dry-run reports affected rows; migration assigns `expiresAt` default 90d to tokens without expiry.

- [ ] T016 [US3] Cache invalidation API & pubsub — services/web/app/src/routes/cacheInvalidate.mjs, services/web/lib/pubsub.js, services/git-bridge/src/main/java/\*\*/cacheSubscriber. Acceptance: `POST /internal/api/cache/invalidate` implemented and `auth.cache.invalidate` published on revoke/delete events; include integration tests for subscriber services purging caches on invalidation.

- [ ] T016b [US3] Cache invalidation integration tests — test/integration/cache-invalidation/\*\*. Acceptance: publish `auth.cache.invalidate` and assert remote service instances purge caches within TTL; test `POST /internal/api/cache/invalidate` immediate invalidation.
- [ ] T018 [US3] Scope evaluation & tests — services/git-bridge/src/main/java/**/ScopeEvaluator.java, test/unit/**, test/contract/\*\*. Acceptance: implement scope parsing and evaluation (`repo:read`, `repo:write`, `repo:admin`, optional resource-id), unit tests for mapping to allowed RPCs, and contract tests covering negative cases.

- [ ] T019 [US5] Config startup validation — services/web/app/src/config/validateConfig.mjs, services/git-bridge/src/main/java/\*\*/ConfigChecker.java. Acceptance: service startup validates presence and sanity of required keys (`AUTH_TOKEN_HASH_ALGO`, `AUTH_TOKEN_ARGON2_TIME`, `AUTH_TOKEN_ARGON2_MEMORY_KB`, `CACHE_LOOKUP_TTL_SECONDS`, etc.) and CI unit tests cover missing/misconfigured keys.

Checklist:

- [ ] Implementation
- [ ] Tests
- [ ] Documentation

- [ ] T008b [US1] Malformed SSH public_key validation tests — test/contract/\*\*. Acceptance: invalid `public_key` format returns 400 with validation guidance and does not create a key.
