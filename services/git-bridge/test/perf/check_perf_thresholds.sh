#!/usr/bin/env bash
set -euo pipefail

REPORT=${1:-services/git-bridge/test/perf/report.json}
P95_THRESHOLD_MS=${P95_THRESHOLD_MS:-2000}
P99_THRESHOLD_MS=${P99_THRESHOLD_MS:-10000}

if [ ! -f "$REPORT" ]; then
  echo "Report file not found: $REPORT" >&2
  exit 2
fi

clone_ms=$(jq -r '.clone_ms // 0' "$REPORT")
push_ms=$(jq -r '.push_ms // 0' "$REPORT")

# For now treat clone and push separately and fail if either exceeds thresholds

echo "Perf report: clone_ms=$clone_ms push_ms=$push_ms"

if [ "$clone_ms" -gt "$P95_THRESHOLD_MS" ]; then
  echo "FAIL: clone p95 ($clone_ms ms) > threshold ($P95_THRESHOLD_MS ms)" >&2
  exit 1
fi

if [ "$push_ms" -gt "$P99_THRESHOLD_MS" ]; then
  echo "FAIL: push p99 ($push_ms ms) > threshold ($P99_THRESHOLD_MS ms)" >&2
  exit 1
fi

echo "Perf thresholds OK"
exit 0
