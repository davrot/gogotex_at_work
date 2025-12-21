#!/usr/bin/env bash
set -euo pipefail
NODE_BASE=${1:-http://develop-web-1:3000}
GO_BASE=${2:-http://localhost:3900}
TOKEN=${3:-invalid-token}
OUTDIR="tmp/introspect_results/$(date +%s)"
mkdir -p "$OUTDIR"

NODE_OUT="$OUTDIR/node_introspect.json"
GO_OUT="$OUTDIR/go_introspect.json"

NODE_CODE=$(curl -sS -u overleaf:overleaf -o "$NODE_OUT" -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}" "$NODE_BASE/internal/api/tokens/introspect" || true)
GO_CODE=$(curl -sS -u overleaf:overleaf -o "$GO_OUT" -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}" "$GO_BASE/internal/api/tokens/introspect" || true)

echo "NODE_CODE=$NODE_CODE GO_CODE=$GO_CODE"
if [ "$NODE_CODE" -ne "$GO_CODE" ]; then
  echo "Status code mismatch: node=$NODE_CODE go=$GO_CODE"
  exit 2
fi

# Normalize whitespace and check 'active' field equality
NODE_ACTIVE=$(jq -r '.active // "null"' "$NODE_OUT")
GO_ACTIVE=$(jq -r '.active // "null"' "$GO_OUT")

if [ "$NODE_ACTIVE" != "$GO_ACTIVE" ]; then
  echo "Introspect active field mismatch: node=$NODE_ACTIVE go=$GO_ACTIVE"
  exit 3
fi

echo "Introspect parity check PASSED: active=$NODE_ACTIVE"
exit 0
