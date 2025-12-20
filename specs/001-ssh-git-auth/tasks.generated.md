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

3. Perf harness & CI
   - Add `services/git-bridge/test/perf` harness and a scheduled/smoke CI job with 2 vCPU, 4GB runner.
   - Record p95/p99 latencies and add gating checks.

4. Cross-team coordination and rollout
   - Schedule design review with Infra and Security to confirm auth model (mTLS vs bearer token) and rollout plan.
   - Ensure audit logging and tracing compliance.

5. Cleanup & docs
   - Remove legacy OAuth/HTTP auth code paths once tests confirm full SSH-only parity.
   - Update docs (`docs/ssh-keys.md`) and the README with migration notes.

**Notes**: Tasks should be split into small PRs, each including tests and CI adjustments. Prioritize task (1) to stabilize contract tests before broad migrations.
