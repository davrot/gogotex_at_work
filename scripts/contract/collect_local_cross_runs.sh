#!/usr/bin/env bash
set -euo pipefail

# Collect local cross-instance run outputs and aggregate them into the flakiness collector
# Usage: ./scripts/contract/collect_local_cross_runs.sh [--src <path>] [--copy]
#  --src: path to a cross-instance-results.json (defaults to ci/webprofile-parity/cross-instance-results.json)
#  --copy: copy the source into ci/flakiness/collected with a timestamped filename before aggregation

SRC="ci/webprofile-parity/cross-instance-results.json"
COPY=false
OUT_DIR=ci/flakiness/collected

# simple arg parsing
while [ $# -gt 0 ]; do
  case "$1" in
    --src)
      shift
      SRC="$1"
      ;;
    --copy)
      COPY=true
      ;;
    -h|--help)
      echo "Usage: $0 [--src <path>] [--copy]"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      echo "Usage: $0 [--src <path>] [--copy]"
      exit 2
      ;;
  esac
  shift
done

mkdir -p "$OUT_DIR"

if [ ! -f "$SRC" ]; then
  echo "No source cross-instance results file found at $SRC"
  echo "Please run the cross-instance runner first (scripts/contract/run_cross_instance_locally.sh or cross_instance_ci_runner.sh)"
  exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$OUT_DIR/run_local_${TIMESTAMP}_cross.json"

if [ "$COPY" = true ]; then
  cp "$SRC" "$DEST"
  echo "Copied $SRC -> $DEST"
else
  echo "Skipping copy; aggregating directly from $SRC"
  # to ensure collector still sees the current run, we write a transient file used for aggregation
  cp "$SRC" "$OUT_DIR/run_local_latest_cross.json"
  echo "Wrote $OUT_DIR/run_local_latest_cross.json for aggregation"
fi

# Run the main collector which will pick up files in ci/flakiness/collected and update ci/flakiness/cross/*
./scripts/contract/collect_flakiness.sh

echo "Aggregated cross-instance results available at: ci/flakiness/cross/aggregate_cross.json"
echo "Dashboard: ci/flakiness/cross/dashboard.html"

exit 0
