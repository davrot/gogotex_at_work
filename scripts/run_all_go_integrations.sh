#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

SERVICES=$(find services -maxdepth 1 -type d -name '*-go' | sort)

PASS=()
FAIL=()

for d in $SERVICES; do
  SCRIPT="$d/test/integration/run_integration.sh"
  if [ -x "$SCRIPT" ]; then
    echo "\n=== running integration for $d ==="
    LOG="/tmp/$(basename $d)-integration.log"
    if bash "$SCRIPT" --remote-db-test > "$LOG" 2>&1; then
      echo "PASS: $d"
      PASS+=("$d")
    else
      echo "FAIL: $d (see $LOG)"
      echo "--- log start ---"
      sed -n '1,200p' "$LOG" || true
      echo "--- log end ---"
      FAIL+=("$d")
    fi
  else
    echo "skip: $d (no $SCRIPT)"
  fi

done


echo "\n=== Summary ==="
echo "Passed: ${#PASS[@]}"
for p in "${PASS[@]}"; do echo " - $p"; done

echo "Failed: ${#FAIL[@]}"
for f in "${FAIL[@]}"; do echo " - $f"; done

if [ ${#FAIL[@]} -ne 0 ]; then
  exit 2
fi
