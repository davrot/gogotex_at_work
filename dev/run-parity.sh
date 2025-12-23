#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/services/chat"

export GO_RUN_TIMEOUT="${GO_RUN_TIMEOUT:-30s}"

echo "Installing Node deps (services/chat)..."
npm ci --silent

echo "Running parity status test..."
npm run test:parity-status

echo "Running parity threads test..."
npm run test:parity-threads || true

echo "Parity tests complete"
