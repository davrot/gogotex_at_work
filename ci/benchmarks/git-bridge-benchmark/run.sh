#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
mkdir -p ci/benchmarks/git-bridge-benchmark
( cd services/git-bridge && go test -bench=. ./... -run=^$ > ../../ci/benchmarks/git-bridge-benchmark/out.txt 2>&1 ) || true
ls -l ci/benchmarks/git-bridge-benchmark/out.txt
tail -n 50 ci/benchmarks/git-bridge-benchmark/out.txt
