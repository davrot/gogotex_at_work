# tasks.generated.md

## Phase 2 (Implementation & Verification)

1. Stabilize SSH key create idempotency under concurrency (high priority)
   - Correlate `/tmp/ssh_upsert_debug.log` events with DB state and client timestamps for failing runs.
   - Add more instrumentation (include Node process uptime and Mongo replica timing meta if available).
   - Add targeted unit/integration tests reproducing raw.value null upsert returns; validate fallback fetch path.
   - **Acceptance**: salted `SSHKeyStressRepro` test runs reliably ≥5 times without returning `other:40` / `listLength:0`.

2. Add Go `git-bridge` SSH server factories/tests
   - Implement WLUploadPack/WLReceivePack factories in Go and unit tests.
   - Add integration tests that exercise a minimal SSH connection against the local stack and assert proper authentication via internal API.

2.5 Dev environment safety & test hardening (cross-cutting)
   - Add host validation helper scripts to prevent the use of `127.0.0.1` or `localhost` inside dev containers and E2E scripts (e.g. `scripts/dev/validate-host.sh`).
   - Update developer docs (`docs/dev-setup.md`) and local env defaults to recommend compose hostnames (e.g., `mongo`, `develop-web-1`) and document the risk of using `127.0.0.1` in containers.
   - Add CI checks (lint or test job) that run hostname validation against critical E2E scripts to prevent regressions.
   - **Acceptance**: E2E and acceptance scripts fail fast and provide explicit guidance when a blocked host (localhost/127.0.0.1) is detected.

3. Perf harness & CI
   - Add `services/git-bridge/test/perf` harness and a scheduled/smoke CI job with 2 vCPU, 4GB runner.
   - Record p95/p99 latencies and add gating checks.

4. Cross-team coordination and rollout
   - Schedule design review with Infra and Security to confirm auth model (mTLS vs bearer token) and rollout plan.
   - Ensure audit logging and tracing compliance.

4.5 Migrate web-profile internal API (Node → Go)
   - Implement a minimal Go web-profile shim that provides `GET /internal/api/users/:userId/ssh-keys` and `POST /internal/api/users/:userId/ssh-keys` with identical response shapes and logging.
   - Add contract tests validating parity: run the same contract suite against Node and Go implementations and fail CI on divergence.
   - Run the Go shim in shadow mode for read and/or write traffic and compare outcomes; instrument observability parity.
   - Update `git-bridge` to optionally call the Go web-profile API in shadow mode, and add integration tests where `git-bridge` authenticates via the Go service.
   - CI: add `go test` jobs and build jobs; ensure cross-build gating before cutover; remove Java/Maven build steps for git-bridge when Go parity is proven.
   - **Acceptance**: Contract tests pass on both Node and Go; Go shim runs in shadow mode and shows parity across ≥5 runs.

5. Cleanup & docs
   - Remove legacy OAuth/HTTP auth code paths once tests confirm full SSH-only parity.
   - Update docs (`docs/ssh-keys.md`) and the README with migration notes.

**Notes**: Tasks should be split into small PRs, each including tests and CI adjustments. Prioritize task (1) to stabilize contract tests before broad migrations.
