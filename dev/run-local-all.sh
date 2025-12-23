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
  (cd services/chat && npm ci --silent) || echo "npm ci failed in services/chat (continue)"
  # Prefer service-local eslint, then repo-root eslint, then global eslint
  if [ -x "services/chat/node_modules/.bin/eslint" ]; then
    (cd services/chat && npm run lint) || echo "Lint warnings or errors in services/chat (see above)"
  elif [ -x "./node_modules/.bin/eslint" ]; then
    echo "Using repo-root eslint to lint services/chat"
    ./node_modules/.bin/eslint --max-warnings 0 --format unix services/chat || echo "Lint warnings or errors in services/chat (see above)"
  elif command -v eslint >/dev/null 2>&1; then
    echo "Using global eslint to lint services/chat"
    eslint --max-warnings 0 --format unix services/chat || echo "Lint warnings or errors in services/chat (see above)"
  else
    echo "Skipping lint in services/chat: eslint not found locally or at repo root. To enable, add eslint to services/chat devDependencies or install it at the repo root."
  fi
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
  (cd services/web && npm ci --silent) || echo "npm ci failed in services/web (continue)"
  # Prefer 'npm test' if defined, otherwise fall back to 'local:test' or explicit unit tests
  if npm --prefix services/web run | grep -q " test\b"; then
    (cd services/web && npm test) || echo "services/web tests returned non-zero exit code"
  elif npm --prefix services/web run | grep -q " local:test\b"; then
    (cd services/web && npm run local:test) || echo "services/web local tests returned non-zero exit code"
  else
    echo "No 'test' or 'local:test' script found in services/web; listing available test scripts:"
    npm --prefix services/web run | sed -n '1,120p' | grep test || true
    echo "Skipping services/web tests. Add a 'test' or 'local:test' script to run tests as part of dev/run-local-all.sh"
  fi
fi

# Benchmarks
echo "--- Running benchmarks ---"
./dev/run-bench.sh || echo "Benchmarks returned non-zero exit code"

# Optional bench note
echo "--- Bench artifacts (if any) are in dev/artifacts ---"

echo "=== run-local-all: complete ==="
