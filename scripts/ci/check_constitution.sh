#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
FAIL=0

echo "Running constitution compliance checks..."

# 1) Lint plugin present
if [ ! -d "$ROOT_DIR/libraries/eslint-plugin" ]; then
  echo "ERROR: eslint plugin directory missing: libraries/eslint-plugin" >&2
  FAIL=1
else
  echo "OK: eslint plugin present"
fi

# 2) Unit tests presence (services/web/test or ai_at_work/test/unit)
if ls "$ROOT_DIR/services/web/test/unit"/*.mjs >/dev/null 2>&1 || ls "$ROOT_DIR/services/web/test"/*.mjs >/dev/null 2>&1; then
  echo "OK: unit tests present under services/web/test"
else
  echo "ERROR: unit tests not found under services/web/test" >&2
  FAIL=1
fi

# 3) Contract tests presence
if [ -d "$ROOT_DIR/services/web/test/contract" ] && [ "$(ls -A "$ROOT_DIR/services/web/test/contract" | wc -l)" -gt 0 ]; then
  echo "OK: web contract tests present"
else
  echo "ERROR: web contract tests missing under services/web/test/contract" >&2
  FAIL=1
fi

# 4) Bench harness config existence (T0AA)
if [ -f "$ROOT_DIR/ci/benchmarks/harness-config.json" ]; then
  echo "OK: bench harness config present"
else
  echo "ERROR: ci/benchmarks/harness-config.json not found (T0AA)" >&2
  FAIL=1
fi

# 5) Bench scripts present
if [ -f "$ROOT_DIR/ci/benchmarks/key-lookup-benchmark/bench.js" ] && [ -f "$ROOT_DIR/ci/benchmarks/introspection-benchmark/bench.js" ]; then
  echo "OK: bench scripts present"
else
  echo "ERROR: bench scripts missing under ci/benchmarks" >&2
  FAIL=1
fi

# 6) CI gating presence heuristic: check for bench references in CI config files
if grep -q "ci/benchmarks" .gitlab-ci.yml 2>/dev/null || grep -q "ci/benchmarks" ci/contract/gitlab-ci-contract.yml 2>/dev/null || [ -f ".github/workflows/check-constitution.yml" ]; then
  echo "OK: CI references to ci/benchmarks detected (gating may be present)"
else
  echo "WARN: Cannot detect CI gating referencing ci/benchmarks. Ensure T033 gating is added to your CI." >&2
fi

if [ "$FAIL" -ne 0 ]; then
  echo "Constitution compliance checks failed" >&2
  exit 2
fi

echo "Constitution compliance checks passed"