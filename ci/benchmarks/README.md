Benchmarks harness — key-lookup & introspection

Purpose

This directory contains micro-benchmark harnesses used to validate and gate performance SLOs for the SSH key lookup path (`GET /internal/api/ssh-keys/:fingerprint`) and the token introspection endpoint (`POST /internal/api/tokens/introspect`). These harnesses are used for local runs and CI gating.

Runner profile (normative)

- CPU: 2 vCPU
- Memory: 4 GB
- Disk: modest (bench artifacts are small)

Datasets

Provide a seeded dataset for each benchmark. Recommended sizes:

- key-lookup: 1k–10k keys distributed across ~200 users
- introspection: synthetic tokens sized to represent expected token store

Place seeds under `ci/benchmarks/{key-lookup-benchmark, introspection-benchmark}/seed.json` when available.

Warm and cold runs

Benchmarks support both warm and cold runs.

- Cold run: ensure cache is cleared before running; run `BENCH_WARM=0`.
- Warm run: pre-populate caches and then run with `BENCH_WARM=1`.

Commands

- Key lookup (example):
  BENCH_URL=http://develop-web-1:3000/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA BENCH_ITER=200 BENCH_CONCURRENCY=20 BENCH_OUTPUT=out.json node ci/benchmarks/key-lookup-benchmark/bench.js

- Introspection (example):
  BENCH_URL=http://localhost:3000/internal/api/tokens/introspect BENCH_ITER=200 BENCH_CONCURRENCY=20 BENCH_TOKEN=invalid-token BENCH_OUTPUT=out.json node ci/benchmarks/introspection-benchmark/bench.js

Artifact format

Bench scripts write a JSON object with at least the following keys:

- p50: number
- p95: number
- p99: number
- samples: number
- errors: number

CI usage

- CI jobs should run both warm and cold harness runs and publish artifact files (e.g., `ci/benchmarks/key-lookup-benchmark/out.json`).
- CI gating job must fail the merge when p95 thresholds are exceeded. See `ci/benchmarks/harness-config.json` for SLOs and runner profile.

Notes

- Use the documented runner profile to guarantee reproducibility.
- Keep the harness commands simple and idempotent so they can be run locally and in CI.
