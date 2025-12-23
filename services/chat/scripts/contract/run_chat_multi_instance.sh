#!/usr/bin/env bash
set -euo pipefail

# Wrapper to run a multi-instance chat integration test and collect artifacts
# Usage:
#  - With Docker (default): runs `services/chat/scripts/run_multi_instance_local.sh` which spins up a temporary Mongo container
#  - In CI where Docker isn't available: set NO_DOCKER=1 and provide MONGO_URI to connect to an existing Mongo service

ARTIFACT_DIR=${ARTIFACT_DIR:-ci/chat-multi-instance}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$ARTIFACT_DIR"
OUT="$ARTIFACT_DIR/multi-instance-run-$TIMESTAMP.out"

if [ "${NO_DOCKER:-}" = "1" ]; then
  if [ -z "${MONGO_URI:-}" ]; then
    echo "MONGO_URI required when NO_DOCKER=1" >&2
    exit 2
  fi
  echo "Running multi-instance integration connecting to Mongo at ${MONGO_URI}" | tee "$OUT"
  # Start two Go instances against the provided Mongo and run test
  PORT_A=${PORT_A:-3011}
  PORT_B=${PORT_B:-3012}
  GO_RUN_TIMEOUT=${GO_RUN_TIMEOUT:-120s}

  bash -lc "MONGO_URI=\"${MONGO_URI}\" PORT=${PORT_A} timeout ${GO_RUN_TIMEOUT} go run ./cmd/chat" &
  PID_A=$!
  bash -lc "MONGO_URI=\"${MONGO_URI}\" PORT=${PORT_B} timeout ${GO_RUN_TIMEOUT} go run ./cmd/chat" &
  PID_B=$!

  # Wait for readiness
  for i in {1..30}; do
    if curl -sfS "http://127.0.0.1:${PORT_A}/status" >/dev/null 2>&1 && curl -sfS "http://127.0.0.1:${PORT_B}/status" >/dev/null 2>&1; then
      echo "Instances ready" | tee -a "$OUT"
      break
    fi
    sleep 1
  done

  node services/chat/test/integration/multi_instance_test.js 2>&1 | tee -a "$OUT"
  rc=${PIPESTATUS[0]:-0}
  echo "Multi-instance run exit: $rc" | tee -a "$OUT"
  kill $PID_A $PID_B 2>/dev/null || true
  exit $rc
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not available, set NO_DOCKER=1 and provide MONGO_URI" | tee -a "$OUT" >&2
    exit 2
  fi
  echo "Running local multi-instance runner (docker-backed); output -> $OUT" | tee "$OUT"
  if [ -x services/chat/scripts/run_multi_instance_local.sh ]; then
    services/chat/scripts/run_multi_instance_local.sh 2>&1 | tee -a "$OUT"
    rc=${PIPESTATUS[0]:-0}
    echo "Local multi-instance run exit: $rc" | tee -a "$OUT"
    exit $rc
  else
    echo "Local multi-instance runner not found: services/chat/scripts/run_multi_instance_local.sh" | tee -a "$OUT" >&2
    exit 2
  fi
fi
