#!/usr/bin/env bash
set -euo pipefail

# Wrapper to run Chat contract tests and collect artifacts
# Usage:
#  - With Docker (default): runs services/chat/scripts/run_contract_local.sh which spins up a temporary Mongo container
#  - In CI where Docker isn't available: set NO_DOCKER=1 and provide MONGO_URI to connect to an existing Mongo service

ARTIFACT_DIR=${ARTIFACT_DIR:-ci/chat-contract}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$ARTIFACT_DIR"
OUT="$ARTIFACT_DIR/contract-run-$TIMESTAMP.out"

if [ "${NO_DOCKER:-}" = "1" ]; then
  if [ -z "${MONGO_URI:-}" ]; then
    echo "MONGO_URI required when NO_DOCKER=1" >&2
    exit 2
  fi
  echo "Running chat contract test connecting to Mongo at ${MONGO_URI}" | tee "$OUT"
  env MONGO_URI="$MONGO_URI" GO_PORT="${GO_PORT:-3011}" node services/chat/test/contract/messages_contract_test.js 2>&1 | tee -a "$OUT"
  rc=${PIPESTATUS[0]:-0}
  echo "Contract run exit: $rc" | tee -a "$OUT"
  exit $rc
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not available, set NO_DOCKER=1 and provide MONGO_URI" | tee "$OUT" >&2
    exit 2
  fi
  echo "Running local contract runner (docker-backed); output -> $OUT" | tee "$OUT"
  # Reuse existing local helper which spins up a Mongo container, runs contract and cleans up
  if [ -x services/chat/scripts/run_contract_local.sh ]; then
    services/chat/scripts/run_contract_local.sh 2>&1 | tee -a "$OUT"
    rc=${PIPESTATUS[0]:-0}
    echo "Local contract run exit: $rc" | tee -a "$OUT"
    exit $rc
  else
    echo "Local contract runner not found: services/chat/scripts/run_contract_local.sh" | tee -a "$OUT" >&2
    exit 2
  fi
fi
