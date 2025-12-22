---
description: "Tasks for SSH-only Git authentication feature"
---

# Tasks: SSH-only Git authentication for git-bridge

**Input**: Design documents from `specs/001-ssh-git-auth/` (plan.md, spec.md)

## Repository consolidation (modz imports)

- [x] T050 Import reduced snapshots for related modules into `modz/` (e.g., `modz/sandbox-compile`, `modz/admin_extensions`, `modz/ai_assistant`, `modz/latex-editor`, `modz/references`, `modz/track-changes-and-comments`, `modz/logo_tools`) — **Status:** imported to `integrate/modz`.
  - Acceptance: files for each module are present under `modz/<module>` and include an `IMPORT.md` and provenance metadata.
- [x] T051 Verify `modz/latex-editor` matches the canonical 31-file list and prune extraneous files (if any).
  - Acceptance: `git ls-files modz/latex-editor` lists the 31 files (plus `IMPORT.md`/metadata) and the branch commit documents the shrink.
- [ ] T052 Run module-specific unit/integration/lint checks for each imported module under `modz/` and fix failures.
  - Acceptance: `npm test` or equivalent for the module completes successfully on `integrate/modz` for each module, or the failures are triaged and tracked in follow-up tasks.
  - Subtasks (prioritized):
    - [x] T052a (P1) `modz/latex-editor` — **Add frontend unit tests & build/lint scripts.** (PARTIAL)
      - Acceptance: `npm test` (or `pnpm test`) executes and passes; `build` and `lint` scripts present; add Playwright E2E if applicable.
      - Notes: smoke test added; full component/unit accessibility tests remain as follow-up (see T052e/T052h).
    - [x] T052b (P1) `modz/ai_assistant` — **Add server & frontend unit tests.** (COMPLETED)
      - Acceptance: tests for controllers/hooks are present and pass; `package.json` includes `test` script.
      - Notes: LLM config checker and controller unit tests added; local live-test gating added.
    - [x] T052c (P1) `modz/track-changes-and-comments` — **Add unit & integration tests for DocumentUpdater and review-panel.** (COMPLETED)
      - Acceptance: unit and integration tests run and pass; linting configured.
      - Notes: `DocumentManager` unit test added with lightweight stubs; further integration tests can be added in follow-ups.
    - [x] T052d (P1) `modz/sandbox-compile` — **Verify & restore `services/clsi` tests, CI job parity.** (PARTIAL)
      - Acceptance: `services/clsi` tests run locally (e.g., 356 passing) and CI job configured to run them.
      - Notes: smoke tests added; CI workflow includes smoke job; Docker-dependent checks remain manual or require CI secrets.
    - [ ] T052e (P2) `modz/references` — **Add frontend unit tests and worker tests for reference indexing.**
      - Acceptance: tests for indexer and worker exist and pass; stylesheets and translations lint/format validated.
    - [ ] T052f (P2) `modz/admin_extensions` — **Add controller & frontend tests (ProjectList, UserActivate).**
      - Acceptance: tests cover critical endpoints and components and pass in CI or locally.
    - [ ] T052g (P3) `modz/logo_tools` — **Add smoke/script tests validating scripts run and produce expected artifacts.**
      - Acceptance: shell/Python smoke tests run in CI and verify outputs (e.g., generated icons exist).
    - [x] T052h (P3) **Add module test-harness docs** — `modz/.ci/test-harness.md` describing how to run per-module tests, required env vars, and any docker/redis dependencies. (PARTIAL)
      - Acceptance: docs present and verified on a dev machine; CI jobs reference the docs.
      - Notes: `MOD_INFO.md` files created with run instructions and notes for live tests.
    - [ ] T052i (P1) **Create follow-up issues/PRs** for modules where tests cannot be added immediately; include owner, estimated effort, and blocking dependencies.
      - Acceptance: Issues created and linked from this task for visibility.
- [ ] T053 Open PR(s) for `integrate/modz` (or per-module integrate branches), request module-owner review, and add CI jobs to validate multi-instance tests where required (e.g., Redis-enabled jobs for pubsub tests).
  - Acceptance: PR(s) created, CI jobs run and are green or have documented failures with mitigation plans.
- [ ] T054 Archive or remove `other_mods/` after validation and confirmation that `modz/` contains canonical, approved snapshots.
  - Acceptance: `other_mods/` moved to an archive location or removed in a follow-up commit with a short justification in the PR.

## Phase 1: Setup (Shared Infrastructure)

- [ ] T002 Verify and add runtime config keys in `services/git-bridge/conf/envsubst_template.json` (`GIT_BRIDGE_WEB_PROFILE_API_URL`, `GIT_BRIDGE_WEB_PROFILE_API_TOKEN`, `GIT_BRIDGE_SSH_ONLY_FLAG`)
- [ ] T003 [P] Add/verify README documentation for git-bridge runtime config in `services/git-bridge/README.md` and include example env var values for dev/staging.
- [ ] T001 [P] Add developer quickstart step: document and test rebuild/restart steps (run `develop/bin/build` then `./bin/up`) to ensure contract tests run reliably in dev; include a short checklist in `services/git-bridge/README.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Ensure `WebProfileClient` exists and can call internal API: services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/auth/WebProfileClient.java
- [ ] T005 Implement or verify `SSHAuthManager` core routines (parsing, fingerprinting, matching): services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/auth/SSHAuthManager.java
- [ ] T006 [P] Add unit tests for key parsing and fingerprint matching: services/git-bridge/src/test/java/uk/ac/ic/wlgitbridge/auth/SSHAuthManagerTest.java
- [ ] T007 [P] Add logging utilities/hooks for security events in services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/logging/ (create package if missing)
- [ ] T008 Add feature-flag wiring and environment checks to services/git-bridge/conf/envsubst_template.json and services/git-bridge/README.md
- [ ] T030 Create API contract (OpenAPI) for web-profile SSH keys: specs/001-ssh-git-auth/contracts/web-profile-ssh-keys.openapi.yaml
- [ ] T031 [P] Add contract tests validating API schema and auth behaviour (use MockServer): tests/contract/web-profile-ssh-keys.contract.test (or service-specific test paths)
- [ ] T032 Create API contract (OpenAPI) for membership checks: specs/001-ssh-git-auth/contracts/membership.openapi.yaml
- [ ] T033 [P] Add contract tests validating membership behaviour (use MockServer): services/git-bridge/src/test/java/uk/ac/ic/wlgitbridge/contracts/MembershipContractTest.java

---

## Phase 3: User Story 1 - SSH Git access (Priority: P1) 🎯 MVP

**Goal**: Authenticate all Git operations via SSH keys retrieved from internal web-profile API and reject non-SSH auth.

**Independent Test**: Add a public SSH key to a user's profile in the web UI; run an automated integration test that performs SSH auth against a test repo and verifies clone/push succeed.

### Tests

- [ ] T009 [P] [US1] Add an integration test that simulates SSH authentication (unit/integration harness): services/git-bridge/src/test/java/uk/ac/ic/wlgitbridge/integration/SSHAuthenticationIT.java
- [ ] T010 [P] [US1] Add unit tests for successful and failed auth paths in services/git-bridge/src/test/java/uk/ac/ic/wlgitbridge/auth/ (extend SSHAuthManagerTest.java)

### Implementation

- [ ] T011 [US1] Wire `SSHAuthManager` into the git auth entrypoint by updating services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/git/servlet/WLGitServlet.java to call SSHAuthManager before allowing git operations
- [ ] T012 [US1] Implement retrieval of user keys via `WebProfileClient.getUserSSHKeys(userId)` in the auth code path: services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/auth/WebProfileClient.java and services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/auth/SSHAuthManager.java
- [ ] T013 [US1] Add security logging for successful/failed SSH auth attempts: services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/logging/SSHAuthLogger.java
- [ ] T014 [US1] Document runtime verification steps in services/git-bridge/README.md including how to set `GIT_BRIDGE_WEB_PROFILE_API_URL` and `GIT_BRIDGE_WEB_PROFILE_API_TOKEN` and enable the SSH-only flag

---

## Phase 4: User Story 2 - Remove legacy API & auth (Priority: P1)

**Goal**: Remove HTTP Basic and OAuth2 auth codepaths from git-bridge; add opaque rejection behavior and audit logging for deprecated attempts.

**Independent Test**: Deploy with legacy endpoints removed and run tests that attempt HTTP Basic and OAuth2 — verify opaque rejection and logged events.

### Tests

- [ ] T015 [P] [US2] Add tests that send HTTP Basic and OAuth2 requests to git-bridge and assert opaque rejection and audit log entries: services/git-bridge/src/test/java/uk/ac/ic/wlgitbridge/auth/DeprecatedAuthTests.java

### Implementation

- [ ] T016 [US2] Search for and remove OAuth2 filter registrations and HTTP Basic handlers in services/git-bridge/src/main/java and configuration directories; list files changed in review note: services/git-bridge/src/main/java/** and services/git-bridge/conf/**
- [ ] T017 [US2] Implement a small opaque rejection filter/handler that returns a generic 401-like response for deprecated auth methods: services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/security/DeprecatedAuthRejectFilter.java
- [ ] T018 [US2] Ensure deprecated auth attempts are logged to the security logger WITHOUT sensitive details: services/git-bridge/src/main/java/uk/ac/ic/wlgitbridge/logging/DeprecatedAuthLogger.java

---

## Phase 5: User Story 3 - SSH key management UI (Priority: P2)

**Goal**: Provide UI and backend endpoints in the web service to add, list, and revoke SSH public keys on the user's account.

**Independent Test**: Use UI automation or API tests to add a key via the web UI, verify persistence in MongoDB (through web-profile API), and confirm auth via git-bridge integration test from US1.

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Update codebase scanning/CI to assert no OAuth2/HTTP Basic handlers remain in services/git-bridge: .github/workflows/\*\* or CI scripts
- [ ] T027 (updated) [P] Add performance harness, benchmarks, and CI gating for clone/push latency:
  - Add a benchmark script `services/git-bridge/test/perf/benchmark_clone_push.sh` (or Go harness) that runs clone/push against a representative repo (<=1MB, <=10 files) and emits JSON metrics: p50,p95,p99, errors, and duration.
  - Define thresholds: p95 < 2s, p99 < 10s; scheduled perf job fails if thresholds exceeded.
  - Add a GitHub Actions workflow `.github/workflows/perf-git-bridge.yml` that runs nightly and archives results as artifacts `perf/git-bridge-YYYYMMDD.json`.
  - Add a lightweight on-PR smoke job (5 runs) that warns on regressions (non-blocking).
- [ ] T028 [P] Update developer quickstart and docker-compose dev files to document SSH-only testing and env vars: develop/docker-compose.dev.yml and services/git-bridge/README.md
- [ ] T029 [P] Security review and documentation updates in docs/security/ssh-git-auth.md
- [ ] **T034 [P] Validate private-key handling**: Add integration and unit tests to assert that private keys are never persisted to MongoDB or application logs. Tests MUST:
  - verify back-end controller endpoints (web-profile controller and any import APIs) reject or strip private-key submissions,
  - assert DB documents for SSH keys contain only public key and optional non-reversible metadata (e.g., `private_key_hash`), and
  - add a CI gate that fails if any test detects private-key storage or leakage.

- [ ] T035 Consolidate SSH key FRs (merge FR-004/FR-008) and add contract tests to validate retrieval & storage contract (update spec.md accordingly)
- [ ] T036 Add opaque rejection tests for deprecated auth methods and assert structured logging (see FR-005)
- [ ] T037 Add duplicate-key behaviour tests (idempotent for same-user, 409 for conflict) and controller assertions
- [ ] T038 Replace `/tmp/ssh_upsert_debug.log` with structured logger events and add unit tests verifying emitted fields (no private key data)
- [ ] T039 Add metrics instrumentation for SSH upsert flows and a smoke test validating counters/histograms
- [ ] T040 Add env flag to gate verbose debug logs (staging only) and remove production reliance on `/tmp` debug files

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Update codebase scanning/CI to assert no OAuth2/HTTP Basic handlers remain in services/git-bridge: .github/workflows/\*\* or CI scripts
- [ ] T027 [P] Add performance smoke test for Git clone/push latency in services/git-bridge/test/perf/ (simple harness)
- [ ] T028 [P] Update developer quickstart and docker-compose dev files to document SSH-only testing and env vars: develop/docker-compose.dev.yml and services/git-bridge/README.md
- [ ] T029 [P] Security review and documentation updates in docs/security/ssh-git-auth.md
- [ ] **T034 [P] Validate private-key handling**: Add integration and unit tests to assert that private keys are never persisted to MongoDB or application logs. Tests MUST:
  - verify back-end controller endpoints (web-profile controller and any import APIs) reject or strip private-key submissions,
  - assert DB documents for SSH keys contain only public key and optional non-reversible metadata (e.g., `private_key_hash`), and
  - add a CI gate that fails if any test detects private-key storage or leakage.

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phase 3+) → Polish
- User Story ordering by priority: US1 (P1) and US2 (P1) are top priority — complete Foundational then implement US1 and US2 first. US3 (P2) can proceed after Foundational and once US1 core auth flow is in place.
- Parallel opportunities: tasks marked with [P] can be executed in parallel by different engineers (unit tests, logging hooks, docs, frontend unit tests).

## Parallel execution examples

- Implementing tests and logging can run in parallel with model/service implementation (see T006, T007, T009, T010).
- Frontend component work (T023) can proceed in parallel with backend controller (T021) once the contracts (endpoints and payload shape) are agreed.

## Implementation strategy

- MVP first: deliver US1 only (Phase 3) after Foundational tasks to enable end-to-end SSH auth; verify integration tests; then remove legacy auth (US2) and finally deliver UI (US3).
- Incremental delivery: finish Phase 1+2 → implement US1 (verify) → implement US2 (remove legacy paths) → implement US3 (UX polish)

---

Generated-by: assistant (GPT-5 mini) from specs/001-ssh-git-auth/plan.md and spec.md
