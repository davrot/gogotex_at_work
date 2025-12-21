Title: Promote SSH delegation parity to required CI checks

Description:

This PR will make SSH delegation parity checks required in CI by merging `ci/PARITY_STRICT` into the default branch (already present in branch `chore/remove-java-sources`). Before merging ensure:

- The `ssh_delegation_parity_check` job has been run and is passing reliably over several runs.
- Playwright E2E smoke tests successfully exercise the delegation flow in CI runners and artifacts show the delegated key visibility in Go and service-facing list endpoints.
- Contract tests (`compare_ssh_contract_test.go`) pass in CI and are tolerant to runner shim absence when appropriate.

Files changed in the ready branch:

- `services/web/app/src/Features/User/UserSSHKeysController.mjs` — service-facing delegation
- `services/web/test/unit/.../Webdelegation.ssh.test.mjs` — unit tests
- `services/web/test/e2e/playwright/ssh_delegation_parity.mjs` — extended to check service-facing list
- `doc/golang_webprofile_migration.md` — migration notes and canary rollout
- `develop/dev.env` — enabled `AUTH_SSH_USE_WEBPROFILE_API=true` for dev/canary

Next steps after approval:

1. Merge the branch to default (CI will require parity checks afterward).
2. Monitor CI and triage any flakiness. If stable for several runs, prepare to flip the default to `true` in staging/production manifests and coordinate rollout.
3. Close migration todos and update release notes.

Validation performed by automation:

- I ran the Playwright SSH delegation parity smoke test locally **twice** (via `scripts/ci/run_ssh_smoke_ci.sh` with `DELEGATION_PARITY=1` and `AUTH_SSH_USE_WEBPROFILE_API='true'`) and observed successful runs with Playwright artifacts in `services/web/test/e2e/playwright/out/` and parity JSONs in `tmp/parity_results/`.
- Targeted unit tests for SSH delegation and fingerprint lookup passed (`Webdelegation.ssh.test.mjs`, `Webdelegation.sshlookup.test.mjs`).
- The contract parity compare test for SSH (`compare_ssh_contract_test.go`) passes in isolation; broader contract tests require the dev compose environment to be up (these run in CI).

Operational note:

- I added a `deploy/staging.env.example` template (staging ops can use this to flip `AUTH_SSH_USE_WEBPROFILE_API=true` in staging when they are ready to roll out). Please coordinate the staging flip and monitor the parity job for **N** successful runs (suggest N=10) before promoting to production.
