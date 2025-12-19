Title: ci: robust timeout + spec updates for SSH auth feature

Summary:
- Implement a robust process-group timeout in `scripts/ci/run_ssh_smoke_ci.sh` (setsid + group kill + marker) and add `VERIFY_HANG` for safe verification.
- Make CI-facing updates to the feature spec: formalize benchmark harness, add repository-path mapping examples, and require idempotency/concurrency tests for SSH key creation.
- Add contract test `SSHKeyIdempotencyContractTest.mjs` and repo-path unit test skeleton in `git-bridge`.
- Add tasks: T001a (Constitution compliance), T0AA (benchmark harness), T0YY (repo-path tests), T0ZZ (idempotency contract). Marked `T033` (CI gating) as BLOCKING.

What I tested:
- Local verification of timeout behavior with `VERIFY_HANG=1` and small `SMOKE_TIMEOUT`.
- Added contract test skeletons and unit test skeleton for repo-path parsing.

Next steps:
- Implement harness T0AA and CI gating T033 (BLOCKING) so performance benchmarks block merges when SLOs are violated.
- Implement repo-path parsing in `git-bridge` and make the unit tests pass.
- Flesh out the idempotency contract test and run it in CI.

Notes:
- I did not remove the `VERIFY_HANG` helper; it is available for quick verification. I can remove it before final merge if you prefer.
- Suggest reviewer(s): @davrot, @maintainer-team
