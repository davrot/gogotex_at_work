Title: Enable WebProfile SSH delegation in staging

This branch/PR enables `AUTH_SSH_USE_WEBPROFILE_API=true` in the staging environment by adding `deploy/staging.env` with the flag set to true.

Purpose

- Allow running the parity CI smoke test in staging to validate Node→Go delegation for SSH (create/list/remove + fingerprint lookups) in a staging environment prior to production rollout.

What I ran/pushed

- Branch: `pr/enable-webprofile-ssh-staging` (commit `09acd4be62...`)
- File added: `deploy/staging.env` with `AUTH_SSH_USE_WEBPROFILE_API=true`

Validation plan (automation)

1. Wait for the `ssh_delegation_parity_check` job to run on this branch and confirm the Playwright parity smoke test passes.
2. Require **N=10** consecutive successful parity runs (recommended) in CI to consider the parity stable.
3. If any runs fail, I will triage failures, collect artifacts, and fix tests or CI config as needed.

Notes for reviewers

- This change is a controlled staging flip only (no production change). Please review and approve so CI can validate.
- If you want me to proceed to open/merge the PR on success after N runs, I can do that autonomously.

Automation: I'll start monitoring PR creation and CI runs and report back with results and artifacts.
