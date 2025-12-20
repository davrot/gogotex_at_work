# Golang Migration Plan (living document)

**Status:** Draft — update as the migration progresses.

## Summary

This document captures the approach and concrete plan for an incremental migration of Overleaf backend code from Node.js/Java to Go (Golang). The migration is intended to be incremental, low-risk, and reversible: migrate one route/service at a time, verify parity with contract tests, ensure observability and performance parity, and progressively remove Node/Java code once parity is established.

---

## Goals

- Replace legacy Java `git-bridge` with a Go implementation and validate parity.  
- Migrate internal web-profile APIs used by `git-bridge` (e.g., SSH key lookup and create) to Go as a first step.  
- Provide a repeatable, audited path to migrate additional web routes over time.  
- Keep production uptime, SLOs, and auditability unchanged through the migration.

---

## Scope (initial)

- Primary target: `services/git-bridge` and the minimal set of web routes it depends on:
  - `POST /internal/api/users/:userId/ssh-keys` (create/upsert)
  - `GET /internal/api/users/:userId/ssh-keys` (list)
  - Fingerprint lookup endpoints
- Longer-term: other stateless API endpoints and helper services; UI and session-heavy routes are migrated last.

---

## Principles

- Incremental & reversible: migrate small surfaces with clear rollback plans.  
- Contract-first: define OpenAPI / contract tests for each route and require tests to pass on both Node and Go.  
- Observability parity: logs, metrics, traces, and audit events must be equivalent to Node to preserve incident response.  
- Performance & stability: gate each migration by SLOs (p95/p99) and contract test stability (≥5 consecutive runs).  
- Automation: CI must run contract tests against both implementations and block merge on divergence.

---

## Migration phases

### Phase 0 — Research & Prep (done / ongoing)
- Inventory routes & dependencies used by `git-bridge`.  
- Create spec & contract files (OpenAPI for ssh-keys present at `specs/001-ssh-git-auth/contracts/ssh-keys.yaml`).  
- Add dev safety checks (no `127.0.0.1` usage, host validation scripts).  

### Phase 1 — Shim & Tests
- Implement a minimal Go shim (web-profile API) that mirrors Node responses (done basic prototype).  
- Add unit tests for fingerprinting & upsert semantics (handle driver edge-cases).  
- Add contract tests that run against Node and Go services; add CI job to execute both sets and fail on mismatch.  
- Add local dev compose entries and docs to run the Go shim locally.

### Phase 2 — Shadow Mode & Integration
- Run the Go shim in shadow mode (duplicate requests logged to Go but not used to serve production).  
- Compare observability: logs, metrics, traces, audits for parity.  
- Add `git-bridge` shadow calls to Go and collect comparison metrics (errors, latencies, outcomes).

### Phase 3 — Canary & Partial Cutover
- Route a small percentage of traffic or job types to Go (canary).  
- Monitor SLOs, error rates, and user-visible behavior.  
- Increase rollout incrementally if stable.

### Phase 4 — Cutover & Cleanup
- Flip traffic fully for the migrated route(s).  
- Remove Node handlers in small PRs and update docs.  
- Remove Java build steps for `git-bridge` once Go parity verified.  

### Phase 5 — Iterate & Expand
- Repeat for subsequent route sets prioritized by risk & independence.

---

## Acceptance criteria (per route)

- Contract tests pass against Node *and* Go (same status codes, response shapes, and edge-case semantics).  
- Observability parity: required log fields, audit events, and key metrics are present and comparable.  
- Performance: p95/p99 not significantly worse than Node (target parity or improvement).  
- Stability: shadowed runs show consistent parity across ≥5 successful runs.  
- CI: tests are automated and fail the pipeline on divergence.

---

## Tests & CI

- Unit tests: small, deterministic tests for logic and edge-cases.  
- Contract tests: Mocha/Playwright/OpenAPI driven tests that run against both implementations and compare results.  
- Integration tests: run `git clone`/`git push` workflows against the real `git-bridge` + Go shim.  
- Perf tests: run perf harness (p95/p99 capture) in CI in a scheduled or on-demand job.  
- Add a CI job `contract:node-and-go` that: 1) builds Go shim, 2) runs contract suite with Node, 3) runs contract suite with Go, 4) diffs results and fails if non-equivalent.

---

## Observability & Logging

- Keep structured log fields consistent (userId, fingerprint, requestId, outcome, timestamp).  
- Emit the same audit events (e.g., `sshkey.added`, `sshkey.removed`, `auth.http_attempt`).  
- Add metrics for request latency and error rates per route.  
- Ensure traces link across `git-bridge` → web-profile Go shim (instrument with trace ids or context propagation where available).

---

## Rollback & Safety

- Always merge small, reversible PRs.  
- Use feature flags or router-level canaries to quickly redirect traffic back to Node.  
- Keep runtimes side-by-side until parity is proven; preserve Node code until Go is stable.

---

## Tasks (high-level, link to `specs/001-ssh-git-auth/tasks.generated.md`)

- Implement Go shim (GET/POST ssh keys) — done (prototype).  
- Add contract tests and CI job — TODO.  
- Add shadow-mode wiring in `git-bridge` — TODO.  
- Run shadow + canary, then cutover — TODO.  
- Remove legacy Java components and update CI to stop building Java artifacts — TODO.

---

## Risks & Mitigations

- Semantic mismatch → heavy contract testing and test harnesses.  
- Performance regressions → perf harness, gate on p95/p99.  
- Operational differences (logging, metrics) → require observability parity before cutover.

---

## Communication & Governance

- Schedule design review with Infra and Security for auth/authz patterns (mTLS vs bearer token) early in Phase 1.  
- Keep a migration checklist in the feature spec and tasks; include a rollout & rollback plan per route.  

---

## How to update this doc

- This is a living document. Update `docs/golang-migration-plan.md` and add subtasks to `specs/001-ssh-git-auth/tasks.generated.md` as work progresses.  

---

Document author: GitHub Copilot (Raptor mini (Preview)). Last updated: 2025-12-20
