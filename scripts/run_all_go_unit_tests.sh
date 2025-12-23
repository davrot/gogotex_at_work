#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

RUN_DB=${RUN_DB:-0}
# detect inside dev container (VS Code dev container or other containerized env)
IN_DEV_CONTAINER=0
if [ -f "/.dockerenv" ] || [ -n "${DEVCONTAINER:-}" ] || [ -n "${INSIDE_DEV_CONTAINER:-}" ]; then
  IN_DEV_CONTAINER=1
fi
# --run-db flag for convenience
if [[ ${1:-} == "--run-db" ]]; then
  RUN_DB=1
fi
# If we're inside a dev container, running DB-backed unit tests may break due to
# disallowed use of localhost/127.0.0.1 inside the dev container (see docs/dev-setup.md)
# To avoid surprises, skip DB integration unless forced with RUN_DB_FORCE=1
if [ "$IN_DEV_CONTAINER" = "1" ] && [ "$RUN_DB" = "1" ] && [ -z "${RUN_DB_FORCE:-}" ]; then
  echo "WARNING: running inside a dev container; skipping DB-backed unit tests by default."
  echo "If you really want to run DB-backed tests inside the dev container, set RUN_DB_FORCE=1 and ensure your environment is configured per docs/dev-setup.md"
  RUN_DB=0
fi

PASSED=()
FAILED=()

SERVICES=$(find services -maxdepth 1 -type d -name '*-go' | sort)
for d in $SERVICES; do
  echo "\n=== running unit tests for $d ==="
  if [ -f "$d/go.mod" ]; then
    if [ "$RUN_DB" = "1" ]; then
      echo "running tests with RUN_DB_INTEGRATION=1"
      if (cd "$d" && RUN_DB_INTEGRATION=1 go test ./... -v); then
        echo "PASS: $d"
        PASSED+=("$d")
      else
        echo "FAIL: $d"
        FAILED+=("$d")
      fi
    else
      if (cd "$d" && go test ./... -v); then
        echo "PASS: $d"
        PASSED+=("$d")
      else
        echo "FAIL: $d"
        FAILED+=("$d")
      fi
    fi
  else
    echo "skip: $d (no go.mod)"
  fi
done

echo "\n=== Summary ==="
echo "Passed: ${#PASSED[@]}"
for p in "${PASSED[@]}"; do echo " - $p"; done

echo "Failed: ${#FAILED[@]}"
for f in "${FAILED[@]}"; do echo " - $f"; done

if [ ${#FAILED[@]} -ne 0 ]; then
  exit 2
fi

echo "All unit tests passed"
