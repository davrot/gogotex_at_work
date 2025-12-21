#!/usr/bin/env bash
set -euo pipefail

# Deprecated: GitLab-specific helper removed.
# This repo now uses a repository-controlled toggle `ci/PARITY_STRICT`.
# To set strict mode, add the file `ci/PARITY_STRICT` with content `true` on the default branch via a PR.

echo "This helper is deprecated. Use 'ci/PARITY_STRICT' repository file to control parity strictness."