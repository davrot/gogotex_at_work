#!/usr/bin/env bash
set -euo pipefail

# Collect local cross-instance run outputs and aggregate them into the flakiness collector
# Usage: ./scripts/contract/collect_local_cross_runs.sh [--src <path>] [--copy]
#  --src: path to a cross-instance-results.json (defaults to ci/webprofile-parity/cross-instance-results.json)
#  --copy: copy the source into ci/flakiness/collected with a timestamped filename before aggregation

SRC=${1:-ci/webprofile-parity/cross-instance-results.json}
COPY=${2:---copy}
OUT_DIR=ci/flakiness/collected
mkdir -p "$OUT_DIR"

if [ ! -f "$SRC" ]; then
  echo "No source cross-instance results file found at $SRC"
  echo "Please run the cross-instance runner first (scripts/contract/run_cross_instance_locally.sh or cross_instance_ci_runner.sh)"
  exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$OUT_DIR/run_local_${TIMESTAMP}_cross.json"

if [ "$COPY" = "--copy" ] || [ "$COPY" = "copy" ]; then
  cp "$SRC" "$DEST"
  echo "Copied $SRC -> $DEST"
else
  echo "Skipping copy; aggregating directly from $SRC"
fi

# Run the main collector which will pick up files in ci/flakiness/collected and update ci/flakiness/cross/*
scripts/contract/collect_flakiness.sh

echo "Aggregated cross-instance results available at: ci/flakiness/cross/aggregate_cross.json"
echo "Dashboard: ci/flakiness/cross/dashboard.html"

exit 0
