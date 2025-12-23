# services/chat — Rollout & rollback runbook (draft)

Overview

- Goal: Safely flip `services/chat` runtime from Node → Go with minimal risk. We adopt a canary-first approach with artifact review and automatic rollback triggers. This runbook documents preflight checks, canary steps, monitoring/rollback criteria, and post-rollout validation.

Preflight (before any deployment)

- Tests & artifacts
  - Ensure `go test ./...` passes in `services/chat` locally and in CI.
  - Run the contract wrapper and collect artifacts:
    - `ARTIFACT_DIR=ci/chat-contract NO_DOCKER=1 MONGO_URI="mongodb://127.0.0.1:27017/chat_test" scripts/contract/run_chat_contract.sh`
    - Confirm `ci/chat-contract/contract-run-<TS>.out` contains no errors and messages persist in Mongo.
  - Run benchmarks and validate SLOs (p95 <= target): `node services/chat/bench/threads_bench.js` → save logs to artifacts.
- Config & infra
  - Ensure `.github/workflows/run-chat-contract.yml` has run (manual) and artifacts archived for inspection.
  - Prepare image tag for Go binary (e.g., `chat:go-<sha>`), and push to registry accessible by CI/infra.
  - Confirm rollback image (Node image tag) is available and tested.
- Owners & windows
  - Migration owner, SRE, and QA must be available during the cutover window.
  - Schedule a maintenance window for canary → ramp (if customer-impacting).
- Observability
  - Ensure metrics/alerts are in place: request error rate (5xx), latency histograms for message endpoints, Mongo error rates, and overall service health.
  - Define thresholds and alerts:
    - 5xx rate > 0.5% (absolute) or increase > 5x baseline → consider rollback
    - p95 latency increase > 2x baseline or > configured SLO threshold → consider rollback
    - Mongo write failures or persistence errors observed in contract-run artifacts → rollback

Canary cutover (small subset / single instance)

1. Deploy the Go image to a single canary instance (or route 5% traffic).
   - Example (k8s): `kubectl set image deployment/chat chat=registry/chat:go-<sha> --record` and target a single replica.
   - Example (docker-compose/dev): create a compose override that uses the Go image for one replica.
2. Run quick smoke checks:
   - `curl -f http://<canary-host>:3011/status`
   - Run the contract test against the canary: `MONGO_URI="mongodb://<mongo-host>:27017/chat_test" GO_PORT=3011 node services/chat/test/contract/messages_contract_test.js`
   - Verify messages created by the contract are persisted in Mongo and queries return expected results.
3. Monitor metrics and logs for 5–15 minutes:
   - Check p50/p95, error rates, Mongo connection errors, and unusual log traces.
4. If smoke & metrics are good, increase traffic (or replicas) incrementally (e.g., 5% → 25% → 50% → 100%) with 10–15 minute observation windows between steps.

Rollforward criteria

- Contract tests pass on canary with persisted messages.
- Bench p95 remains within acceptable range and does not regress above SLO.
- No alert thresholds are breached during observation windows.
- Owners (migration owner + SRE) acknowledge metrics are stable.

Rollback criteria & actions

- Immediate rollback triggers:
  - 5xx error rate exceeds threshold (> 0.5% or 5x baseline).
  - p95 latency > 2x baseline or exceeds configured SLO.
  - Mongo write/persistence failures observed in contract tests or production logs.
- Rollback steps:
  1. Revert the deployment to the previous Node image (or previous deployment revision). Example (k8s): `kubectl rollout undo deployment/chat` or `kubectl set image deployment/chat chat=registry/chat:node-<sha>`.
  2. If using docker-compose, re-deploy the prior compose with Node image.
  3. Verify `status` endpoints on reverted instances and run smoke tests from step 2 to validate behavior.
  4. Collect artifacts (logs, `ci/chat-contract/*`, metrics snapshots) and open an incident ticket linking artifacts and the failing observations.

Post-rollout validation

- After reaching 100% traffic, run a full contract run and bench to confirm parity and SLOs:
  - `scripts/contract/run_chat_contract.sh` (NO_DOCKER=1 in CI) and bench harness.
- Promote the Go image/tag to the stable channel and update Dockerfiles / runit / `develop/docker-compose.yml` references to the Go runtime as needed.
- Update server ships (e.g., server-ce runit scripts, deployment docs) to reference Go binary or Go-built image.
- Close any open migration issues and mark `T047` as completed once owners sign off.

Sign-off checklist

- [ ] All unit tests and parity tests pass in CI.
- [ ] Manual contract run artifacts reviewed and OK (`ci/chat-contract/*`).
- [ ] Bench SLOs met for p95 and accepted by SRE.
- [ ] Canary smoke tests pass and no alert thresholds fired during observation.
- [ ] Rollback plan verified and rollback image available.
- [ ] Owners (migration owner / SRE / QA) have signed off.
- [ ] Rollout/rollback runbook added to `.specify/migrations/services/chat.md` and acknowledged in PR description.

Acceptance to close T047

- All items in the Sign-off checklist are checked, the manual CI run shows successful artifacts, and the Go runtime is promoted to stable (or a documented follow-up is agreed). At that point update `T047` status to **completed** and update the migration audit.

Notes

- Drafted runbook added to `.specify/migrations/services/chat-rollout.md` — please review and sign off.
