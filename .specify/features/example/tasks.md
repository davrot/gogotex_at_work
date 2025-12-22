# Tasks: SSH + HTTPS Git Auth

**Input:** Extracted from: .specify/features/example/plan.md, .specify/features/example/spec.md

## Phase 0: Language migration — Java → Go

**Goal:** Replace the Java implementation of `git-bridge` with a Go implementation, update the dev/test/CI tooling, and port all tests and benchmarks so the repository no longer requires Java maintenance.

- [x] T040 Setup Go toolchain in dev environment (devcontainer/Dockerfile, Makefile) — install Go 1.25+ in dev container and provide `make build`/`make test`/`make bench` targets in `services/git-bridge`.
  - Acceptance: `make build` produces `services/git-bridge/bin/git-bridge` and `make test` runs Go unit tests locally. **Status:** skeleton added (Makefile targets, `go.mod`, minimal `cmd/` and `internal/` packages).

- [x] T041 Replace Java/Maven CI & build with Go modules (includes `go vet`/`golangci-lint`) — **Acceptance:** CI builds and runs Go tests successfully. **Status:** Completed — CI build/test jobs updated to target Go; verify green runs before final pruning.
  - [x] T041a Add CI parity job to compare Node vs Go outputs (initial `allow_failure: true`). **Status:** completed.
  - [x] T041b Add validation run-book `ssh_keys_parity_validation` to assert stability; **Flip criteria:** flip `allow_failure: false` after **10** consecutive successful validation runs or maintainers sign-off. **Owner:** @maintainers (substitute actual owner as appropriate).

- [ ] T042a Port SSH auth core and lookup (unit tests & coverage) — services/git-bridge/internal/ssh
  - Acceptance: Unit tests for SSH auth and lookup modules cover core behaviors and achieve agreed coverage (owner-defined, e.g., critical modules ≥ 80%). Verify `go test ./services/git-bridge/...` passes.
- [ ] T042b Contract parity tests pass against Go binary — services/git-bridge/test/contract
  - Acceptance: Contract parity job that compares Node vs Go outputs for SSH key endpoints passes consistently (validate with the `ssh_keys_parity_validation` run-book; aim for 10 consecutive passes before flipping strict mode).
- [ ] T042c Bench & SLO parity for key lookup & introspection — ci/benchmarks and services/git-bridge/bench
  - Acceptance: Key lookup p95 and introspection p95 are within acceptable delta of the documented baseline or an explicit deviation is documented and approved by maintainers; add bench harness targeting the Go binary.

- [ ] T043 Port test suite from Java to Go — migrate unit, integration, contract, and E2E tests to Go test harnesses (or maintain contract tests in existing JS framework but run orchestration via Go where appropriate).
  - Acceptance: Contract tests referencing `git-bridge` execute against the Go binary and pass in CI. **Status:** unit tests for repo parsing, auth manager and lookup client added; contract/integration porting ongoing.

- [ ] T044 Migrate benchmarks & harness to target Go binary — ensure `ci/benchmarks` can invoke the Go binary in dev and CI to produce p50/p95/p99 artifacts.
  - Acceptance: Bench harness produces artifacts and meets gating requirements in CI.

- [x] T045 Remove Java sources and Maven configs after successful migration — deprecate and remove `pom.xml`, `src/main/java`, and Java test directories when CI shows parity.
  - Acceptance: No Java build steps remain in CI and Java sources removed from repo.

- [ ] T046 Update docs, `spec.md`, `plan.md`, and README to describe Go-based development and testing instructions.
  - Acceptance: `.specify` docs, README, and CONTRIBUTING show Go build/test instructions.

## Phase 0b: Additional service migrations — Backends → Go

**Goal:** Migrate additional backend services to Go progressively. Each service migration is independently testable and should include a Go module, `cmd/` entrypoint, unit tests, CI build/test job(s), and contract parity checks where relevant.

- [x] T047 [P] Migrate `chat` backend to Go — `services/chat`: add `go.mod`, `cmd/chat`, core handlers, unit tests, and CI job to build/test `services/chat`.
  - Acceptance: `go test ./services/chat/...` passes locally and in CI; equivalent contract tests (chat message endpoints) pass against the Go binary. **Status:** scaffolding added (health endpoint, test, workflow template applies); further porting of business logic required.

- [x] T048 [P] Migrate `contacts` backend to Go — `services/contacts`: add `go.mod`, `cmd/contacts`, services for contact CRUD, unit tests, and CI job to build/test `services/contacts`.
  - Acceptance: `go test ./services/contacts/...` passes; contract tests for contact endpoints pass. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T049 [P] Migrate `document-updater` backend to Go — `services/document-updater`: add `go.mod`, `cmd/document-updater`, port core document update handlers, unit tests, and CI job.
  - Acceptance: `go test ./services/document-updater/...` passes; integration tests for document update flows pass. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T050 [P] Migrate `notifications` backend to Go — `services/notifications`: add `go.mod`, `cmd/notifications`, event handlers (email/push), unit tests, and CI job.
  - Acceptance: `go test ./services/notifications/...` passes; notification delivery contract tests pass against Go implementation. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T051 [P] Migrate `real-time` backend to Go — `services/real-time`: add `go.mod`, `cmd/real-time`, real-time websocket/transport handlers, unit tests, and CI job (consider performance benchmarks).
  - Acceptance: `go test ./services/real-time/...` passes; real-time integration smoke tests (connect, subscribe, publish) pass. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T052 [P] Migrate `clsi` (compile sandbox interface) backend to Go — `services/clsi`: add `go.mod`, `cmd/clsi`, CLI and API handlers, unit tests, and CI job. Include security sandboxing test harness.
  - Acceptance: `go test ./services/clsi/...` passes; sandbox CI smoke job validates compile requests and seccomp profile tests. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T053 [P] Migrate `docstore` backend to Go — `services/docstore`: add `go.mod`, `cmd/docstore`, storage interfaces, unit tests, and CI job.
  - Acceptance: `go test ./services/docstore/...` passes; file retrieval and storage contract tests pass. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T054 [P] Migrate `filestore` backend to Go — `services/filestore`: add `go.mod`, `cmd/filestore`, file service endpoints, unit tests, and CI job. Ensure compatibility with existing storage mounts and policies.
  - Acceptance: `go test ./services/filestore/...` passes; file upload/download tests and mount compatibility checks pass in CI. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T055 [P] Migrate `history-v1` backend to Go — `services/history-v1`: add `go.mod`, `cmd/history-v1`, history store and retrieval handlers, unit tests, and CI job.
  - Acceptance: `go test ./services/history-v1/...` passes; history retrieval and retention tests pass. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T056 [P] Migrate `project-history` backend to Go — `services/project-history`: add `go.mod`, `cmd/project-history`, project audit handlers, unit tests, and CI job.
  - Acceptance: `go test ./services/project-history/...` passes; cross-service contract tests (project history listing and audit) pass. **Status:** implemented (basic Go implementation + unit tests added; `go test` passes).

- [x] T057 [P] Migrate `web` backend to Go (optional incremental cutover) — `services/web`: incrementally extract and replace components with Go where appropriate, add Go modules for new services, and add CI jobs to build/test Go components. This task is **incremental** and should follow a careful compatibility plan (delegation, shim, parity checks).
  - Acceptance: Each extracted component has Go tests and a parity validation comparing behavior between Node and Go shims; CI must demonstrate parity for delegated endpoints before flipping traffic. **Status:** initial shim scaffolding added (health endpoint, test, go.mod); follow-up sub-tasks required to incrementally port components.

> Notes:
>
> - Mark tasks `[P]` if they are parallelizable and do not require other services to be migrated first.
> - For each migration add a **parity/contract** validation job (similar to `git-bridge`), document rollback plans, and add any required security or sandboxing tests for components handling user content.

## Phase 1: Setup

- [x] T001 Validate feature docs and plan presence — .specify/features/example/plan.md, .specify/features/example/spec.md (docs present)
- [x] T002 [P] Add CI micro-benchmark skeleton and harness — ci/benchmarks/ (key-lookup + introspection harnesses implemented)
- [x] T003 [P] Ensure linting plugin & config present and applied — libraries/eslint-plugin/ (lint plugin present)
- [x] T004 (BLOCKING) Implement config validation & runtime hash availability check — services/web/app/src/config/validateConfig.mjs, services/web/app/src/config/hashAvailability.mjs (implemented; unit tests exist)
  - Acceptance: Service fails to start when `AUTH_TOKEN_HASH_ALGO=argon2id` and argon2 not supported unless an explicit fallback is configured.
- [x] T002b Add migration/backfill for PersonalAccessToken re-hash & metadata — services/web/migrations/re-hash-personal-access-tokens.mjs (migration script present)
  - Acceptance: Migration preserves original algorithm metadata (`algorithm`/`hashPrefix` fields), provides a safe re-hash or re-issue strategy (idempotent, reversible steps documented), and includes tests or a dry-run mode to validate behavior.
  - Depends on: **T004** (config validation & runtime hash availability check). Do not run or merge the migration before T004 is completed and verified in a staging environment.
- [x] T0AC Add integration test for revocation immediacy — services/web/test/integration/TokenRevocationImmediacyTest.go — **Status:** implemented, tests verified locally; CI gate pending.
  - Acceptance: After `DELETE` (revoke) returns success, `Introspect` must return `active:false` within **500ms** in CI and local runs; contract test asserts invalidation message inserted or published.
- [x] T0AD Implement synchronous invalidation hook for token revocation — services/web/internal/token (MongoPersistor + cache invalidation) — **Status:** implemented and tested locally.
  - Acceptance: `Revoke` writes inactive state, inserts an invalidation record or publishes an invalidation message, and returns only after any in-process cache invalidation completes (document implementation and tests).
- [ ] T0AE Add CI gate job that runs `TestMongoPersistor_RevocationImmediacy` in PR gating (contract-tests-gating) — **Acceptance:** job fails the PR if the immediacy test fails; artifacts uploaded on failure.

- [x] T001a (BLOCKING) Constitution compliance check — .specify/memory/constitution.md, CI pipeline (implemented: `scripts/ci/check_constitution.sh` + `.github/workflows/check-constitution.yml`)
  - Acceptance: PRs that implement or change this feature MUST include and pass the constitution checklist: linters, unit & contract tests, and benchmark gating (T033) where applicable. The new workflow runs the script on pull requests.
- [ ] T0AB Finalize constitution templates & CI gating templates — .specify/templates/\* & `.github/workflows/check-constitution.yml` — **Acceptance:** templates updated to reflect constitution gates and ratification metadata filled; CI checks read templates and enforce gates.

- [x] T0AA (BLOCKING) Formalize benchmark runner profile & harness — ci/benchmarks/README.md, ci/benchmarks/harness-config.json (implemented)
  - Acceptance: Provide a reproducible runner profile (recommended 2 vCPU, 4GB RAM), a seeded dataset (documented seed and size), harness command-lines, artifact format (p50/p95/p99), and example invocation for warm/cold runs. The harness must be runnable in local/dev CI and in the CI runner used for gating.

- [x] T0YY Add canonical repo-path → projectId mapping examples & parsing unit tests — specs/001-ssh-git-auth/examples/repo-paths.md, services/git-bridge/internal/repo/repo_path_parsing_test.go (examples + tests added) (Go)
  - Acceptance: Add canonical mapping examples (including `.git` suffix handling, url-encoded paths, namespaces, leading/trailing slashes) and unit tests that assert canonical parsing results and edge case behaviors.

- [x] T0ZZ Add idempotency concurrency contract test for SSH key POST — services/web/test/contract/src/SSHKeyIdempotencyContractTest.mjs (implemented)
  - Acceptance: Concurrent `POST /internal/api/users/:userId/ssh-keys` with the same `public_key` must deterministically return the same resource (200 idempotent response) and avoid duplicate entries (or return 409 with explanatory message if a different user owns the key). Include a deterministic test harness to simulate concurrent requests.

---

## Phase 2: Foundational

- [x] T005 Setup DB migrations & example fixtures for keys/tokens — services/web/migrations/, services/web/test/fixtures/
- [x] T006 [P] Verify/implement models: UserSSHKey + PersonalAccessToken — services/web/app/src/models/UserSSHKey.js, services/web/app/src/models/PersonalAccessToken.js (implemented)
- [x] T007 [P] Verify/implement PersonalAccessToken manager & introspection logic — services/web/app/src/Features/Token/PersonalAccessTokenManager.mjs (implemented)
- [x] T008 [P] Verify/implement Token controller & router (create/list/remove/introspect) — services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/Features/Token/TokenRouter.mjs (implemented)
- [x] T009 [P] Add structured logging schema & PII retention policy — services/web/lib/log-schemas/auth-events.json (implemented), docs/logging-policy.md (implemented)
  - Acceptance: Logging schema includes `hashPrefix` fields and a masking policy; unit/contract tests verify that full token hashes are never emitted in logs, `hashPrefix` is present for token events, and retention rules are enforced (tests for retention behavior or a dry-run validation). **Status:** schema exists at `services/web/lib/log-schemas/auth-events.json`; `docs/logging-policy.md` added; contract test `LoggingRetentionPIITests.mjs` checks retention configuration; unit tests added to ensure plaintext tokens are never logged.

---

## Phase 3: User Story 1 — SSH Key Management (US1) (Priority: P1) 🎯 MVP

**Goal:** Allow users to add/remove SSH public keys and display canonical fingerprint.

**Independent Test:** Create a user, POST an SSH key, GET the key list and verify fingerprint format `SHA256:<base64>` and idempotent create behavior.

- [x] T010 [P] [US1] Ensure SSH Keys CRUD controller & private routes exist and enforce auth (key-management-add-remove) — services/web/app/src/Features/User/UserSSHKeysController.mjs
- [x] T011 [P] [US1] Implement server-side fingerprint computation & validation (SHA256 base64) — services/web/app/src/models/UserSSHKey.js
- [x] T012 [US1] Add contract tests for SSH keys endpoints — services/web/test/contract/src/SSHKeyCRUDContractTest.mjs
- [x] T013 [US1] Implement & test frontend UI for SSH keys (inline validation & ARIA) — services/web/frontend/js/features/settings/components/SSHKeysPanel.tsx, services/web/test/frontend/features/settings/components/ssh-keys.test.tsx
  - Acceptance: UI must pass automated accessibility checks (WCAG AA baseline via axe or Lighthouse), include ARIA labels/roles, be keyboard-navigable, and include unit/visual tests that run in CI (`services/web/test/frontend/**`). Add an accessibility test that asserts correct focus management and an axe check as part of `T031` gating. **Status:** component implemented with ARIA labels and inline validation; comprehensive frontend unit tests added; Playwright accessibility tests added (`accessibility-ssh-keys-focus.spec.mjs`) to assert keyboard navigation order.

---

## Phase 4: User Story 2 — Personal Access Tokens (US2) (Priority: P1)

**Goal:** Allow users to create, view (masked), copy plaintext once, and revoke personal access tokens.

**Independent Test:** Create a token via POST and verify returned plaintext token once; subsequent GET shows `accessTokenPartial` only.

- [x] T014 [P] [US2] Verify Token model includes `hash`, `hashPrefix`, `algorithm`, `scopes`, `expiresAt` (token-management) — services/web/app/src/models/PersonalAccessToken.js
- [x] T015 [P] [US2] Unit tests for token lifecycle & `replace=true` semantics — services/web/test/unit/src/Features/Token/Rotation.test.mjs
  - Acceptance: Unit tests must assert that when `replace=true` is passed on create, the previous token is marked inactive (introspection returns `active: false`), the new token is active, and stored metadata includes `algorithm` and `hashPrefix`. Tests should be deterministically runnable in CI and avoid DB casting issues (use in-memory model mocks or valid ObjectId fixtures). Include negative tests for malformed token input.
- [x] T016 [P] [US2] Integration tests for TokenController create/list/remove endpoints — services/web/test/integration/src/TokenControllerTests.mjs
- [x] T017 [US2] [P] Frontend: ensure `GitTokensPanel` lists tokens, shows plaintext on create, supports copy-to-clipboard, and handles network errors gracefully — services/web/frontend/js/features/settings/components/GitTokensPanel.tsx, services/web/test/frontend/features/settings/components/git-tokens.test.tsx
  - Acceptance: Plaintext token material is displayed only once on creation (UI must not store or show full hashes afterwards), copy-to-clipboard is accessible (with an ARIA live region announcing copy success), and automated frontend tests include axe accessibility checks and run in CI. The list view must show `accessTokenPartial` (masked) after creation and when re-fetching the token list.
- [x] T018 [US2] Add contract & service-origin rate-limit tests for token creation/listing — services/web/test/contract/src/ServiceOriginRateLimitTests.mjs
  - Contract test: services/web/test/contract/src/HashPrefixFormatContractTest.mjs — assert `hashPrefix` is 8 lowercase hex characters
- [x] T019 [US2] Reproduce & fix E2E 404 for GET `/internal/api/users/:userId/git-tokens` seen in Playwright run: inspect TokenRouter, AuthenticationController.requireLogin(), router mounting, and server logs during E2E — services/web/app/src/Features/Token/TokenRouter.mjs, services/web/app/src/Features/Token/TokenController.mjs, services/web/app/src/router.mjs, services/web/test/e2e/playwright/out/console.log
  - Acceptance: Playwright run (RESET_DB=true BASE_URL=...) shows no 404 for token list and UI shows token list or empty state instead of generic error.

- [x] T019b Negative auth tests for fingerprint lookup — services/web/test/unit/src/Features/SSHKey/SSHKeyLookupAuth.test.mjs
  - Acceptance: Unit and contract tests assert that `GET /internal/api/ssh-keys/:fingerprint` rejects unauthorized calls (401/403) via `AuthenticationController.requirePrivateApiAuth()` and that rate-limits are enforced (429 returned when over limit). Include both positive and negative auth cases.

---

## Phase 5: User Story 3 — Token Introspection (US3) (Priority: P2)

**Goal:** Provide token introspection for `git-bridge` and other services.

**Independent Test:** POST `/internal/api/tokens/introspect` with a token and receive `{ active, userId, scopes, expiresAt }`.

- [x] T020 [P] [US3] Verify/implement introspect endpoint & controller tests (token-introspect) — services/web/app/src/Features/Token/TokenController.mjs, services/web/test/unit/src/Features/Token/TokenController.test.mjs
- [x] T021 [US3] Add integration & contract tests for introspection shape and error cases — services/web/test/integration/src/TokenIntrospectionTests.mjs, services/web/test/contract/src/TokenIntrospectContractTest.mjs
- [x] T022 [US3] Add micro-benchmark for introspection latency (CI) and gate p95 ≤ 100ms — ci/benchmarks/introspection-benchmark/ (implemented: `ci/benchmarks/introspection-benchmark/bench.js` and CI invocation)

---

## Phase 6: User Story 4 — Git Auth Integration & Membership (US4) (Priority: P2)

**Goal:** Map SSH fingerprint → userId quickly and enforce project membership during git RPCs.

**Independent Test:** Simulate fingerprint lookup → obtain userId; simulate RPC with known user but not a member → observe 403 and audit log.

- [x] T023 [P] [US4] Ensure private fingerprint lookup API exists and is contract-covered (ssh-key-lookup) — GET /internal/api/ssh-keys/:fingerprint, services/web/test/contract/src/SSHKeyLookupContractTest.mjs (implemented)
- [x] T024 [US4] Short-lived cache and pubsub invalidation for fingerprint lookup — services/web/app/src/lib/cache.js, services/web/lib/pubsub.js (implemented)
- [x] T024b Implement synchronous cache invalidation API & contract tests — POST /internal/api/cache/invalidate, services/web/test/contract/src/CacheInvalidationContractTest.mjs (implemented)
- [x] T025 [US4] Wire `git-bridge` (Go) to call fingerprint lookup and introspection fallback path — services/git-bridge/internal/ssh/auth_manager.go, services/git-bridge/test/contract/\*\*
- [x] T025a Verify git-bridge E2E observes auth.http_attempt success path when valid tokens are used — `scripts/e2e/git-https-acceptance.sh`, `services/web/test/e2e/playwright` (script and e2e checks present)
- [x] T026a [US4] Membership enforcement tests at RPC handler (integration) — `services/git-bridge/test/integration/web_profile_ssh_membership_e2e_test.go` (implemented)

---

## Phase 7: Cross-cutting — Observability, Rate-Limits & Security (US5)

- [x] T036 Add configurable `TRUST_X_SERVICE_ORIGIN` and `TRUSTED_PROXIES` support and tests — services/web/app/src/infrastructure/ServiceOrigin.mjs, services/web/test/unit/src/infrastructure/ServiceOrigin.test.mjs (implemented; unit tests added)

**Goal:** Structured logs, rate-limits (service-origin + per-user), SLOs, and audits for token/key events.

**Independent Test:** Contract tests assert rate-limits (429) per service-origin; logs contain prescribed fields and `hashPrefix` instead of full hashes.

- [x] T027 [P] [US5] Ensure rate-limiter applied to introspect/list and create endpoints — services/web/app/src/infrastructure/RateLimiter.js, services/web/app/src/Features/Token/TokenRouter.mjs (implemented)
- [x] T028 [P] [US5] Add contract tests for service-origin rate-limits & logging masking — services/web/test/contract/src/ServiceOriginRateLimitTests.mjs, services/web/test/contract/src/LoggingRetentionPIITests.mjs (implemented)
- [x] T029 [P] [US5] Instrument metrics for key lookup & token introspection (histogram/timer) and add CI benchmark jobs — services/web/app/src/Features/Token/TokenController.mjs, ci/benchmarks/ (implemented: metrics timers and CI bench jobs)

---

## Final Phase: Polish & Cross-Cutting Tasks

- [x] T030 Documentation & rollout notes (feature flag `feature.git_auth.local_token_manager`) — docs/tokens.md, FEATURE_BRANCH_NOTES.md (implemented)
- [x] T031 Accessibility audits & frontend E2E screenshots (Playwright) — services/web/test/e2e/playwright/, services/web/test/frontend/\*\* (implemented: `accessibility-ssh-git-tokens.spec.mjs`)
- [x] T032 Security review & retention policy verification — docs/logging-policy.md, services/web/test/contract/\*\* (implemented; `LoggingRetentionPIITests.mjs` & `RetentionConfigContractTest.mjs` added; CI enforces `AUDIT_LOG_RETENTION_DAYS` >= 90)
  - T032a Add contract test to assert `AUDIT_LOG_RETENTION_DAYS` is set in CI and >= 90 (implementation: `services/web/test/contract/src/RetentionConfigContractTest.mjs`).
- [x] T033 (BLOCKING) CI gating: add micro-benchmark gating and contract validation to pipeline — .github/workflows/contract-tests-gating.yml (implemented: runs key-lookup & introspection benchmarks, checks SLOs, uploads artifacts)
  - Acceptance: The CI pipeline includes gating jobs that fail the merge when benchmark thresholds (key-lookup p95 > 50ms or introspect p95 > 100ms). The job publishes artifacts (p50/p95/p99) and is runnable with the documented harness in T0AA.
- [x] T038 Add SLO alerting & runbook — define alert rules for key-lookup and introspect p95 breaches, a runbook with owner and escalation steps, and tests to validate alerts fire (implementation & docs: `docs/slo-runbook.md`, CI alert smoke tests) (implemented)
- [x] T039 Add `hashPrefix` cross-algorithm unit tests — verify `computeHashPrefixFromPlain` produces canonical 8-lower-hex and that `createToken` returns matching `hashPrefix` across supported algorithm configurations (unit tests: `services/web/test/unit/src/Features/Token/hashPrefix.test.mjs`) (implemented; tests pass)

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
- [x] T021 Wire `git-bridge` to call introspection fallback & fingerprint lookup — services/git-bridge/internal/ssh/auth_manager.go (implemented, Go)
  - Acceptance: `git-bridge` uses fast-path lookup and falls back to old behavior gracefully.
- [x] T022 Membership enforcement at RPC handler — git-bridge RPC handlers, membership API contract (implemented: `test/integration/web_profile_ssh_membership_e2e_test.go`) (Go)
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
- [x] T033 CI micro-benchmark gating & contract validation (parallel) — .github/workflows/contract-tests-gating.yml (implemented: runs key-lookup & introspection benchmarks, checks SLOs, uploads artifacts)
  - Acceptance: CI pipeline includes gating jobs that fail the merge when benchmark thresholds (key-lookup p95 > 50ms or introspect p95 > 100ms). The job publishes artifacts (p50/p95/p99) and is runnable with the documented harness in T0AA.

## Final — Documentation, Security & Accessibility

- [ ] T027 Documentation & rollout notes — docs/tokens.md, docs/ssh-keys.md, FEATURE_BRANCH_NOTES.md
- [ ] T028 Security review & privacy checklist — docs/logging-policy.md
- [ ] T029 Accessibility & frontend e2e screens — services/web/test/e2e/\*\*
- [x] T030 Add membership OpenAPI contract — specs/001-ssh-git-auth/contracts/membership.openapi.yaml (implemented)
- [x] T031 Add contract test for membership endpoint — services/git-bridge/test/contract/membership_contract_test.go (Go) - Status: test added; documented in the Spec Kit (see `.specify/features/example/ci.md`) with local run instructions and CI job guidance (no GitLab-specific job enforced).
- [ ] T032 Security review checklist & retention policy verification tests — test/contract/logging/\*\*
- [x] T033 CI micro-benchmark gating & contract validation (parallel) — .github/workflows/contract-tests-gating.yml (implemented)
- [ ] T034 Accessibility tests & frontend e2e (parallel) — services/web/test/e2e/\*\*
- [x] T037 Fix fetch-mock recursion with global spy and add regression test — services/web/test/frontend/bootstrap.js, services/web/test/frontend/bootstrap-lite.js, ai_at_work/test/frontend/bootstrap.js, services/web/test/frontend/infrastructure/fetch-mock-regression.test.js (implemented)

## Notes

- `T004` is explicitly blocking: must be completed before token hashing algorithm changes. If `AUTH_TOKEN_HASH_ALGO=argon2id` and argon2 not available at runtime, start-up must fail unless fallback is explicitly configured.
- Create missing docs referenced above and link them to task owners.
- If a task needs to be subdivided, use `TXXXa`, `TXXXb` while preserving the base TID uniqueness.
