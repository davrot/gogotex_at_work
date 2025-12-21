Summary of changes (2025-12-21)

- Robust parity scripts:
  - `scripts/contract/compare_tokens_parity.sh` now mounts repo root into docker fallback, accepts externally-provided seeded ids, and includes diagnostics when the seeder script isn't visible in Docker.
  - `scripts/contract/compare_ssh_parity.sh` now supports repo-root mounts, accepts externally-provided fingerprints and can run seeders in Docker when available.
- Go-side fallbacks and tests:
  - Added Go contract tests that seed Mongo directly when Node endpoints are auth-protected: `TestCompareTokensParity` and `TestCompareSSParity`.
  - This makes contract parity checks robust in environments where running node seeders in Docker is not possible.
- CI:
  - Added `ssh_keys_parity_required` job that triggers when `ci/PARITY_STRICT` exists; teams can flip this toggle to enable blocking parity checks once parity is stable.
- Docs:
  - Updated `docs/ci/PR_enable_parity_and_host_checks.md` to reflect script and CI changes.

Notes:
- I pushed branch `chore/remove-java-sources` with the above changes and prepared the CI helper job. Please review and, when parity is validated (e.g., nightly/validation runs), add `ci/PARITY_STRICT` to the default branch to enable the strict parity job.
