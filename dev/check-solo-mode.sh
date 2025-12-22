#!/usr/bin/env bash
set -euo pipefail

echo "Checking Solo/Autonomous Mode status..."
ROOT="$(git rev-parse --show-toplevel)"

SOLO_FILE="$ROOT/.specify/constitution-solo-mode.md"
AUTO_FILE="$ROOT/.specify/autonomous-mode.md"
AI_CTX="$ROOT/.specify/ai-context.md"

if [ -f "$SOLO_FILE" ]; then
  echo "Solo Developer Mode: ENABLED ($SOLO_FILE present)"
else
  echo "Solo Developer Mode: DISABLED"
fi

if [ -f "$AUTO_FILE" ]; then
  echo "Autonomous Mode: ENABLED ($AUTO_FILE present)"
else
  echo "Autonomous Mode: DISABLED"
fi

if grep -q -i "autonom" "$AI_CTX" 2>/dev/null; then
  echo "AI Context: Autonomous mode referenced in $AI_CTX"
fi

echo
echo "Recommended local validation commands (run from repo root):"
cat <<'CMD'
# Services Chat (node + go parity)
cd services/chat && npm ci --silent && npm run test:parity-status && npm run test:parity-threads
cd services/chat && go test ./...

# Services Web (node tests)
cd services/web && npm ci --silent && npm test

# Benchmarks (optional)
node ci/benchmarks/introspection-benchmark/bench.js
node services/chat/bench/threads_bench.js

# Use GO_RUN_TIMEOUT to avoid hanging go run invocations
export GO_RUN_TIMEOUT='30s'
# Example: timeout $GO_RUN_TIMEOUT go run ./cmd/chat
CMD

exit 0
