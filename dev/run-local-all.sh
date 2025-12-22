#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

export GO_RUN_TIMEOUT="${GO_RUN_TIMEOUT:-30s}"

echo "=== dev/run-local-all.sh: starting local validation ==="

# check solo/autonomous mode
./dev/check-solo-mode.sh

# Lint JS in services/chat
if [ -f services/chat/package.json ]; then
  echo "--- Lint: services/chat ---"
  (cd services/chat && npm ci --silent && npm run lint) || echo "Lint warnings or errors in services/chat (see above)"
fi

# Go tests for services/chat (cmd/chat)
if [ -d cmd/chat ] || [ -d services/chat/cmd/chat ]; then
  echo "--- Go tests (services/chat) ---"
  (cd services/chat && go test ./...)
fi

# parity tests
echo "--- Parity tests (services/chat) ---"
./dev/run-parity.sh

# Optional bench note
echo "--- Bench sampling: run dev/run-bench.sh to execute benchmarks ---"

echo "=== run-local-all: complete ==="
