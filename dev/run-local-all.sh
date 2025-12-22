#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

export GO_RUN_TIMEOUT="${GO_RUN_TIMEOUT:-30s}"

echo "=== dev/run-local-all.sh: starting local validation ==="

# preflight & mode checks
./dev/check-preflight.sh
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

# Parity tests
echo "--- Parity tests (services/chat) ---"
./dev/run-parity.sh

# Services web (node tests)
if [ -f services/web/package.json ]; then
  echo "--- Node tests: services/web ---"
  (cd services/web && npm ci --silent && npm test) || echo "services/web tests returned non-zero exit code"
fi

# Benchmarks
echo "--- Running benchmarks ---"
./dev/run-bench.sh || echo "Benchmarks returned non-zero exit code"

# Optional bench note
echo "--- Bench artifacts (if any) are in dev/artifacts ---"

echo "=== run-local-all: complete ==="
