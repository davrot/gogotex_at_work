# Migration Readiness Checklist ✅

This document defines the canonical checklist that each service migration from Node → Go must satisfy _before_ the production runtime is flipped. Use this as the authoritative, per-service gate for safe, incremental rollouts.

> **Solo Developer Mode:** This checklist is a local governance artifact. Do **not** open PRs, create issues, or change GitHub Actions workflows unless you explicitly ask. I can prepare commits or PRs only upon your instruction.

---

## Repo-level readiness (required before any flips)

- [ ] `docs/golang-migration-plan.md` is current and references this checklist.
- [ ] CI jobs for Go builds/tests/benchmarks exist and are passing on the migration branch.
- [ ] Bench gating is configured for critical SLOs and artifacts (p50/p95/p99) are published.
- [ ] Security & dependency scans include Go modules (Dependabot/Snyk or equivalent).
- [ ] A rollout owner & on-call are assigned for the overall migration program.
- [ ] A central migration runbook is available with contact and escalation details.

---

## Per-service readiness checklist (must be completed per service) 🔍

Service: `services/<name>`  
Owner: `@<owner>`  
Status: `draft / in-progress / ready / blocked`

- Parity & correctness
  - [ ] Unit tests exist and pass: `go test ./...` ✅
  - [ ] Contract/integration parity tests exist and pass in CI (e.g., `scripts/contract/compare_<service>_parity.sh`) ✅
  - [ ] Any behavioral diffs are documented and justified

- Performance & SLOs
  - [ ] Bench harness added for critical paths and CI publishes p50/p95/p99 artifacts ✅
  - [ ] Bench p95 meets service-specific SLOs (document threshold) ✅

- Deployment & packaging
  - [ ] `Dockerfile` / builder produces Go image and passes smoke tests ✅
  - [ ] `Makefile` targets: `go-build`, `go-test`, `docker-go-build`, `docker-go-test` exist and documented ✅
  - [ ] Docker/compose/runit manifests updated for local/dev runs and documented ✅

- Observability & policy checks
  - [ ] Metrics & structured logs implemented and dashboards/alerts configured ✅
  - [ ] Security & dependency checks for Go modules included in CI ✅

- Rollout & rollback
  - [ ] Canary rollout plan with health checks and timeboxes defined ✅
  - [ ] Rollback steps validated in a rehearsal (ability to revert traffic within documented SLA) ✅

- Documentation & runbook
  - [ ] `README.md` and runbook include local verification steps and troubleshooting guidance ✅
  - [ ] Owner & escalation contacts recorded in runbook ✅

- Final signed-off artifacts
  - [ ] Evidence: links to CI artifacts (test output, benchmark artifacts) and a migration readiness sign-off

---

## Acceptance criteria for flipping traffic ▶️

All of the following must be true to flip runtime to Go for a service:

1. **Parity:** Contract/parity checks show 0 diffs across N consecutive runs (recommend N=10 for high-confidence; owner may set lower N for low-risk services).
2. **Benchmarks:** p95 SLOs met on canonical runner profile (2 vCPU, 4GB RAM) and no unacceptable regression vs. legacy implementation.
3. **CI:** Build/test/bench jobs pass and publish artifacts; parity jobs are green and artifacts available for audit.
4. **Observability:** Key metrics & logs exist; alerts and dashboard are active and monitored.
5. **Rollback tested:** Rollback procedure validated and able to revert traffic quickly.
6. **Security:** Dependency & security scans pass; any security hardening checks are in place.
7. **Docs:** Runbook & per-service checklist updated with verification commands and owner sign-off.

---

## Local verification commands (copy/paste) 🛠️

Build & test:

```bash
cd services/<service>
make go-build
go test ./... -v
```

Parity check (example):

```bash
# Example for git-bridge / webprofile parity
./scripts/contract/compare_ssh_parity.sh --go-binary ./services/git-bridge/bin/git-bridge
```

Run parity harness locally (container-backed):

```bash
./scripts/contract/run_parity_locally.sh
```

Benchmarks (example):

```bash
# run harness locally; publish artifacts to ./ci/benchmarks/<service>/
node ci/benchmarks/key-lookup/bench.js --target http://localhost:3900
```

Smoke tests:

```bash
# Example health / smoke query
curl -sS -H "Authorization: Bearer <token>" http://localhost:3900/internal/api/ssh-keys/<fingerprint>
```

---

## Rollout & rollback steps (short playbook)

- Step 0: Validate staging dry-run (run smoke & contract tests against staging) ✅
- Step 1: Deploy canary (1%) with new Go runtime to subset of hosts ✅
- Step 2: Monitor SLOs & parity checks for the canary window (30–60m) ✅
- Step 3: Increment traffic (1% → 10% → 25% → 50% → 100%), validating at each step ✅
- Abort & rollback immediately if parity breaches or SLO violations occur; document time taken & incident notes ✅

---

## Governance & PR evidence 📋

- PRs that propose runtime flips MUST include:
  - Links to parity test output (artifacts/logs)
  - Benchmark artifacts and p50/p95/p99 numbers
  - Rollout & rollback plan and owner sign-off
- CI should block merges that flip runtime when any checklist items are missing or failing (enforced by a gating job or a manual sign-off step).

---

## Per-service template (recommended location)

Create `docs/migrations/services/<service>.md` with the following:

- Owner: `@username`
- Status: `ready / in-progress / blocked`
- Links to CI artifacts: test logs, parity diff artifacts, bench artifacts
- Rollout plan & rollback commands
- Local verification steps (copy commands from above)
- Sign-off: `@owner` + date

---

## Next steps

- Review this updated checklist. If you approve, I can commit it to the migration branch and push (only if you ask). I will not open a PR or change workflows without your explicit instruction.

---

Generated draft by GitHub Copilot (Raptor mini (Preview))
