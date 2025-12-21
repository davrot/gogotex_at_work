# Flipping parity toggle to make parity checks blocking

We now use a repository-controlled toggle to avoid dependence on any CI provider or third-party API.

Toggle file:

- Create a file `ci/PARITY_STRICT` in the repository with the content `true` (single line) and merge it to the default branch to **enable** strict parity checks.
- To disable strict checks remove the file (or change its content to `false`) and merge the change.

Steps:

1. Run the manual validation job `ssh_keys_parity_validation` (manual job) from the Pipelines page and ensure **N** consecutive runs pass (choose N=10 by default).
2. Create a PR adding `ci/PARITY_STRICT` with content `true` and get it reviewed/merged.
3. After merge, the next parity job run will treat parity mismatches as blocking and fail the pipeline.

Rollback:

- Revert remove or edit `ci/PARITY_STRICT` via PR and merge to disable strict mode.

Notes:

- This approach is provider-agnostic and auditable (standard PR workflow).
- Artifacts from validation/compare runs are saved to `tmp/parity_results/` and available in the job UI for debugging failures.
