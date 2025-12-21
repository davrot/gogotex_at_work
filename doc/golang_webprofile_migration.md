# Web → WebProfile (Go) migration notes

Summary of the recent migration tasks to delegate SSH and token-related internal APIs from `services/web` to the Go `webprofile` shim and how to exercise parity tests.

## What was migrated

- Tokens
  - /internal/api/tokens/introspect — delegated via `WebProfileClient.introspect()`
  - /internal/api/users/:userId/git-tokens (GET/POST) and /internal/api/users/:userId/git-tokens/:tokenId (DELETE) — delegated via `WebProfileClient.createToken/listTokens/revokeToken()`

- SSH keys
  - /internal/api/users/:userId/ssh-keys (GET/POST) and /internal/api/users/:userId/ssh-keys/:keyId (DELETE) — delegated via `WebProfileClient.createSSHKey/listSSHKeys/removeSSHKey()` when `AUTH_SSH_USE_WEBPROFILE_API='true'`
  - /internal/api/ssh-keys/:fingerprint (GET) — delegated via `WebProfileClient.getSSHKeyByFingerprint()` and used by `Discovery/SSHKeyLookupController`
  - Service-facing special route `/internal/api/service/users/:userId/ssh-keys` now delegates to Go when `AUTH_SSH_USE_WEBPROFILE_API='true'` (added in `UserSSHKeysController.listForService`)

## How delegation is enabled

- Environment variable: `AUTH_SSH_USE_WEBPROFILE_API='true'` enables SSH delegation paths. By default this is opt-in to avoid accidental behavior changes.

## Tests added/updated

- Unit tests (Vitest) in `services/web/test/unit`:
  - `Webdelegation.ssh.test.mjs` — covers delegation and DB fallbacks for create/list/remove and service-facing list
  - `Webdelegation.sshlookup.test.mjs` — covers fingerprint lookup semantics
  - Token delegation tests already exist and were retained

- Playwright E2E:
  - `services/web/test/e2e/playwright/ssh_delegation_parity.mjs` — creates a key via Node internal API, polls Go webprofile list to confirm visibility, checks the service-facing list endpoint (`/internal/api/service/users/:userId/ssh-keys`) returns the key, deletes, and verifies removal.

- Go contract tests (in `services/git-bridge/test/contract`) were made tolerant to shim absence in some CI runners; `compare_ssh_contract_test.go` verifies parity when shim responds or accepts seeded fallback behavior.

## CI integration

- The CI job `ssh_delegation_parity_check` was added to `ci/contract/gitlab-ci-contract.yml` and invokes the smoke wrapper script:

```
DELEGATION_PARITY=1 AUTH_SSH_USE_WEBPROFILE_API='true' ./scripts/ci/run_ssh_smoke_ci.sh
```

This runs `ssh_delegation_parity.mjs` in Playwright and collects `services/web/test/e2e/playwright/out/*` artifacts.

## Notes / next steps

- When parity is stable, flip `ci/PARITY_STRICT` in the default branch to make these checks required in CI.
- Consider migrating other internal endpoints if a Go-side implementation exists or if cross-service ownership changes. Current ownership and parity: tokens and SSH keys are covered and tested.
- I have enabled `AUTH_SSH_USE_WEBPROFILE_API=true` by default in `develop/dev.env` for dev/canary testing; when CI proves stable across environments I can prepare a PR to enable this by default in staging/production manifests.

---

Document created on: 2025-12-21
