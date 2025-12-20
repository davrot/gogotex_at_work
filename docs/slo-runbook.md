# SLO Runbook — SSH Key Lookup & Token Introspection 🔔

Summary

- SLOs:
  - Key lookup p95 ≤ 50 ms
  - Token introspect p95 ≤ 100 ms
- Owners: **infra-team-oncall@example.com** and `#oncall-infra` Slack channel
- Alerting: Prometheus alerting rules configured under `monitoring/prometheus/rules/git_auth_slos.yml` and routed to PagerDuty/Slack.

Alert conditions

- Alert: `KeyLookupLatencyP95High` fires when key lookup p95 > 50 ms for 5 minutes
- Alert: `TokenIntrospectionLatencyP95High` fires when introspection p95 > 100 ms for 5 minutes

Runbook steps (on alert)

1. Acknowledge the alert in PagerDuty / Slack.
2. Check recent benchmark artifacts in CI job `ci/benchmarks/*/out.json` for the relevant job.
   - Use `node ci/benchmarks/check-bench-slo.js <out.json> <threshold>` to verify p95.
3. Check service health and recent deploys:
   - `kubectl get pods -l app=web` (or the equivalent deployment) — check for restarts or OOMs.
   - Check logs for `ssh.key_lookup` / `token.introspect` errors and latency traces.
4. If regressions are present in CI warm/cold runs, revert the recent change or rollback the deployment and notify stakeholders.
5. If problem persists and no recent deploys correlate, escalate to the platform lead and open an incident with timeline and attached artifacts.

Post-incident

- Attach benchmark artifacts (p50/p95/p99) to the incident.
- Add a short RCA in the incident ticket and update this runbook with any steps that would have improved detection or remediation.

Testing & validation

- The CI gating job runs the benchmarks and fails merges when thresholds are exceeded (see `.github/workflows/contract-tests-gating.yml`).
- An alert smoke test (`services/web/test/unit/src/Alerts/check-slo-alert.test.mjs`) validates the SLO checker logic locally.

Notes

- Thresholds are specified in `ci/benchmarks/harness-config.json` and used by both CI and alerting.
- For emergency escalations, use `#oncall-infra` and PagerDuty.
