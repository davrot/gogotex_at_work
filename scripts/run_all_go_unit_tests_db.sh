#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

# Local helper to run DB-backed unit tests across all *-go services.
# This script mirrors the manual CI workflow but runs locally so you don't need to rely on GitHub Actions.

# Run with: ./scripts/run_all_go_unit_tests_db.sh

# Detect dev container and warn
IN_DEV_CONTAINER=0
if [ -f "/.dockerenv" ] || [ -n "${DEVCONTAINER:-}" ] || [ -n "${INSIDE_DEV_CONTAINER:-}" ]; then
  IN_DEV_CONTAINER=1
fi

if [ "$IN_DEV_CONTAINER" = "1" ]; then
  echo "WARNING: Running inside a dev container. Ensure you understand network limitations (localhost vs container)."
  echo "You can override the dev-container guard with RUN_DB_FORCE=1 if you know what you're doing."
fi

# Export RUN_DB_FORCE to allow DB tests even inside dev containers when explicitly requested
export RUN_DB_FORCE=${RUN_DB_FORCE:-}

# Call the default runner
if [ "$IN_DEV_CONTAINER" = "1" ] && [ -z "${RUN_DB_FORCE:-}" ]; then
  echo "Refusing to run DB-backed tests inside a dev container without RUN_DB_FORCE=1"
  exit 1
fi

bash scripts/run_all_go_unit_tests.sh --run-db
