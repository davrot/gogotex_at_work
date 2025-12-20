# Enable parity strict mode (ci/PARITY_STRICT)

This PR adds the repository toggle file `ci/PARITY_STRICT` with content `true` to enable parity checks to be blocking. It uses the repo-based toggle to avoid provider-specific APIs.

Validation: I ran the `ssh_keys_parity_validation` locally/in-network with 10 iterations and observed all passes. Artifacts are in `tmp/parity_results/validate_*`.

Notes:
- The CI job `ssh_keys_parity_check` inspects `ci/PARITY_STRICT` at runtime and will fail the job on mismatch when this file is present with `true`.
- This PR is intentionally small and only changes the toggle file.
