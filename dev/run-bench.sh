#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
ARTIFACT_DIR="$ROOT/dev/artifacts"
mkdir -p "$ARTIFACT_DIR"

echo "Running introspection benchmark (if present)"
if [ -f ci/benchmarks/introspection-benchmark/bench.js ]; then
  (cd ci/benchmarks/introspection-benchmark && (node bench.js > "$ARTIFACT_DIR/introspection_bench_$(date +%s).log" 2>&1 || true))
  echo "Introspection bench output saved to $ARTIFACT_DIR (exit code may be non-zero)"
else
  echo "No introspection bench found"
fi

echo "Running chat threads bench (if present)"
if [ -f services/chat/bench/threads_bench.js ]; then
  (cd services/chat/bench && (node threads_bench.js > "$ARTIFACT_DIR/threads_bench_$(date +%s).log" 2>&1 || true))
  echo "Threads bench output saved to $ARTIFACT_DIR (exit code may be non-zero)"
else
  echo "No threads bench found"
fi

echo "Bench run complete"
