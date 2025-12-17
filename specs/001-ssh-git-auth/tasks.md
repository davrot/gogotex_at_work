---
description: "Tasks for SSH-only Git authentication feature"
---

# Tasks: SSH-only Git authentication for git-bridge

**Input**: Design documents from `specs/001-ssh-git-auth/` (plan.md, spec.md)

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

### Tests

- [ ] T019 [P] [US3] Add backend contract tests for the web-profile SSH key endpoints: services/web/test/unit/src/User/UserSSHKeysController.test.mjs
- [ ] T020 [P] [US3] Add frontend unit/component tests for the account settings SSH Keys component: services/web/test/frontend/features/settings/components/ssh-keys.test.tsx

### Implementation

- [ ] T021 [US3] Add backend controller for SSH key CRUD in services/web/app/src/Features/User/UserSSHKeysController.mjs (endpoints: GET /internal/api/users/:userId/ssh-keys, POST /internal/api/users/:userId/ssh-keys, DELETE /internal/api/users/:userId/ssh-keys/:keyId)
- [ ] T022 [US3] Wire controller routes in services/web/app/src/express-app.js or routing registration file used by the web service
- [ ] T023 [US3] Add frontend account settings component and wiring: services/web/frontend/js/features/settings/components/ssh-keys.tsx and integrate into services/web/frontend/js/features/settings/components/root.tsx
- [ ] T024 [US3] Add server-side validation to reject malformed SSH public keys in services/web/app/src/Features/User/UserSSHKeysController.mjs
- [ ] T025 [US3] Add integration test that verifies key added via web UI is returned by WebProfileClient and usable by git-bridge integration tests: services/web/test/integration/user_ssh_keys.integration.mjs

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
