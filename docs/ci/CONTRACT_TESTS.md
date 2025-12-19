# Contract tests CI gating

This document describes the `contract-tests` gating workflow added to block PRs when contract tests fail policy checks.

What the workflow does

- Runs the services' contract tests under `services/web/test/contract` using the project docker-compose (see `.github/workflows/contract-tests-gating.yml`).
- Uploads the contract test JUnit reports as an artifact (`contract-test-results`).
- Checks that `AUDIT_LOG_RETENTION_DAYS` is configured in the CI environment and is an integer >= 90. If the value is missing or below 90, the job fails the PR.

How to configure

- In GitHub repository Settings → Secrets → Actions, add a secret named `AUDIT_LOG_RETENTION_DAYS` with the retention days (e.g., `90` or `365`).
- Alternatively, ensure your environment sets `AUDIT_LOG_RETENTION_DAYS` when running CI.

Notes

- The retention value is also checked at runtime by `services/web/test/contract/src/LoggingRetentionPIITests.mjs`. If the test is skipped because no config is present, the CI workflow will still enforce that the secret is set to a compliant value.
- If you'd prefer enforcement only in protected branches and not in all PRs, adjust the workflow's triggers accordingly.