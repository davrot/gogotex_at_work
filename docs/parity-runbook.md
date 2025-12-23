# Parity runbook

If automated parity runs detect failures, follow these steps:

1. Check CI artifacts: `webprofile-parity-artifacts` (logs + node.parity.json + analysis.json).
2. Inspect `ci/webprofile-parity/node.parity.json` and `ci/webprofile-parity/test.parity.out` for stack traces and last responses.
3. Check `ci/webprofile-parity/webprofile.log` and `ci/webprofile-parity/mongo.log` for container logs.
4. If failure is transient (rerunner succeeded), note flakiness report in `ci/flakiness/` for the run; consider adding a regression test if failure reproduced more than 3 times.
5. For repeated scheduled failures, the workflow will create an issue automatically; add triage labels and assign maintainers.

Slack alerting:

- Slack notifications are optional. If `secrets.SLACK_WEBHOOK` is set, a parity job failure will send a short summary message to the configured webhook including cross-instance counts when available.
- The weekly flakiness summary job will also send an optional Slack message with cross-instance metrics if `secrets.SLACK_WEBHOOK` is set.
- Thresholds: we consider >3 consecutive scheduled failures a 'major' alert; see `ci/flakiness` artifacts for counts.

Runbook for maintainers:

- For revocation immediacy failures, collect a packet: `node.parity.json`, `test.parity.out`, `webprofile.log`, `mongo.log`, and the failing request/response pairs (if present).
- For cross-instance failures include `ci/webprofile-parity/cross-instance-results.json` (per-run iterations), `cross-instance-iter-*.out`, and `cross-instance-introspect-iter-*.raw` for full request/response traces.

  To collect local cross-instance results into the flakiness aggregator, run:

  ```sh
  ./scripts/contract/collect_local_cross_runs.sh --copy
  ```

  This copies `ci/webprofile-parity/cross-instance-results.json` into `ci/flakiness/collected/` and regenerates `ci/flakiness/cross/aggregate_cross.json` and `ci/flakiness/cross/dashboard.html` for quick inspection.

- The weekly flakiness summary includes a <code>ci/flakiness/cross/dashboard.html</code> dashboard (uploaded as artifact `parity-cross-dashboard`) that provides a quick snapshot of cross-instance metrics; download it from the weekly job artifacts for visual inspection. The dashboard now includes a **historical trend** chart (success rate and failed iterations) generated from `ci/flakiness/collected/*_cross.json` when the collector runs locally or in CI. The collector also writes a machine-readable `ci/flakiness/cross/trend.json` that contains the raw time series used by the dashboard for debugging or further analysis.
- Attempt local repro with `./scripts/contract/run_parity_locally.sh --no-cleanup` and run `./scripts/contract/run_cross_instance_locally.sh --no-cleanup` to reproduce; attach `ci/webprofile-parity-<TIMESTAMP>.tar.gz` to the issue.
