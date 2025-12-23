# Parity & Cross-Instance Testing Changelog

This document summarizes the changes made in the parity and cross-instance flakiness work (branch: `ci/parity-harden-2025-12-23`).

## Summary of work (Dec 23, 2025)

- Added parity testing harness and local helpers to run Node and Go parity checks: `scripts/contract/run_parity_locally.sh`, `scripts/contract/node_parity.js`.
- Implemented **cross-instance revocation** tests and a stable CI-style runner: `scripts/contract/cross_instance_client.js`, `scripts/contract/cross_instance_ci_runner.sh`.
- Containerized the Node parity runner and built a rerunner to mitigate flakiness: `scripts/contract/Dockerfile.node-parity`, `scripts/contract/rerun_with_retries.sh`.
- Added flakiness aggregation, artifacts, and a rerun UI: `scripts/contract/collect_flakiness.sh`, flakiness dashboard generation.
- Implemented cross-instance aggregation and trend dashboard (Chart.js): `scripts/contract/generate_cross_dashboard.py`, producing `ci/flakiness/cross/dashboard.html` and `ci/flakiness/cross/trend.json`.
- Added automated publishing to S3 and GitHub Pages with archival snapshots (timestamped): `scripts/contract/publish_cross_dashboard.sh`, workflow `.github/workflows/parity-dashboard-publish.yml`.
- Added automated weekly and daily jobs:
  - `.github/workflows/parity-flakiness-summary.yml` (weekly summary + alerts and issue creation)
  - `.github/workflows/parity-dashboard-status.yml` (daily status.json artifact)
  - `.github/workflows/parity-dashboard-publish.yml` (weekly publish + archive)
- Added summary JSON and threshold checker to enable automation: `ci/flakiness/cross/summary.json` + `scripts/contract/check_cross_thresholds.py`.
- Added a status badge (SVG) generator and CLI: `scripts/contract/generate_status_badge.py` and `scripts/contract/generate_status_badge.py --help`.
- Added tests for threshold checker, dashboard generator, and status badge.
- Added README badge linking to live dashboard and status badge.
- Updated runbook: `docs/parity-runbook.md` with instructions (collection, thresholds, publishing, badge CLI).

## Notes

- Defaults: `CROSS_RUN_FAIL_THRESHOLD=1`, `CROSS_ITER_FAILURE_RATE_THRESHOLD=0.05`.
- Slack notifications are optional and use `secrets.SLACK_WEBHOOK`.

## Files added/modified (high level)

- scripts/contract/_.sh, _.py, tests/
- .github/workflows/\* (parity-flakiness-summary.yml, parity-dashboard-status.yml, parity-dashboard-publish.yml)
- docs/parity-runbook.md, docs/PARITY_CHANGELOG.md
- README.md (badges)

---

This changelog is intentionally concise; see the branch and the PR for a full set of commits and details.
