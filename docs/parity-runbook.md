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

Publishing dashboards:

- You can publish dashboards automatically from the collector by setting `PUBLISH_DASHBOARD=true` in the environment run for `collect_flakiness.sh` (CI or local).
- To publish to **S3**, set `AWS_S3_BUCKET` and optionally `AWS_S3_PREFIX` and ensure `aws` CLI is configured with credentials. The collector will `aws s3 cp` the dashboard and `trend.json`.
- To publish to **GitHub Pages**, set `GITHUB_PAGES_REPO` (e.g., `owner/repo`) and `GITHUB_TOKEN` with push permission; the collector will push to the `gh-pages` branch under `parity-cross/`.

Thresholds & alerts:

- The collector writes `ci/flakiness/cross/summary.json` containing aggregated cross-instance metrics (run_total, run_failures, iter_total, iter_failures, run_failure_rate, iter_failure_rate).
- The weekly summary job will evaluate thresholds and can create an issue when thresholds are exceeded. For solo developers we **disable automatic issue creation by default** to reduce noise; you can configure the behavior via these environment variables (set as workflow `env` or repository `secrets`):
  - `SKIP_AUTO_ISSUE` (default `true`) — when `true` the weekly job will **not** create issues automatically (set to `false` to enable automatic issue creation)
  - `ISSUE_RUN_THRESHOLD` (default `3`) — number of failing runs that will trigger issue creation when `SKIP_AUTO_ISSUE` is `false`
  - `ISSUE_ITER_RATE_THRESHOLD` (default `0.1`) — iteration-failure rate threshold that will trigger issue creation when `SKIP_AUTO_ISSUE` is `false`
  - `CROSS_RUN_FAIL_THRESHOLD` (default `1`) — number of runs with failures that triggers a cross-instance alert (used for crossAlert evaluation)
  - `CROSS_ITER_FAILURE_RATE_THRESHOLD` (default `0.05`) — fraction of iterations failed across aggregated runs (e.g., `0.05` for 5%) that triggers a cross-instance alert

Issue creation options (customize created issue):

  - `ISSUE_CREATE_AS_DRAFT` (default `true`) — when `true` the created issue will be prefixed with `[DRAFT]` and will also receive the `draft` label to indicate it is a draft-like issue
  - `ISSUE_LABELS` (comma-separated string) — additional labels to add to the created issue (e.g., `bug,parity`)
  - `ISSUE_ASSIGNEES` (comma-separated string) — usernames to assign the created issue to (e.g., `alice,bob`)


Example (CI):

```yaml
# in .github/workflows/parity-flakiness-summary.yml job step environment
env:
  CROSS_RUN_FAIL_THRESHOLD: 1
  CROSS_ITER_FAILURE_RATE_THRESHOLD: 0.05
```

Publishing & archival:

- A scheduled job `parity-dashboard-publish.yml` runs weekly and will call the collector with `--publish` to publish the dashboard to the `gh-pages` branch (if `GITHUB_PAGES_REPO` and `GITHUB_TOKEN` are configured).
- The publisher archives snapshots under `parity-cross/archives/<TIMESTAMP>/dashboard.html` and `trend.json` so you can inspect historical dashboards per-week.
- Artifacts containing recent archived snapshots are uploaded as the `parity-cross-archives` artifact for the weekly run.
- A daily `parity-dashboard-status` workflow generates `ci/flakiness/cross/status.json` and uploads it as artifact `parity-cross-status`. This file includes a timestamp, the aggregated summary, an `iter_rate` and a `threshold_exceeded` boolean so automation or dashboards can poll a small status artifact.

Badge CLI & customization:

- You can generate a small status SVG badge locally using the CLI helper:

```sh
python3 scripts/contract/generate_status_badge.py --out ci/flakiness/cross/status.svg
```

- The badge CLI supports customization flags to override label, colors, size, and input files:
  - `--label` (default: `parity`) — left label
  - `--ok-text` / `--alert-text` / `--unknown-text` — text variants
  - `--ok-color` / `--alert-color` / `--unknown-color` — color hex codes
  - `--status` / `--summary` — input files to read (`status.json` preferred)
  - `--width` / `--height` — SVG size

- The CLI respects `threshold_exceeded` when present in `status.json`, otherwise it computes the iteration failure rate from `summary.json` and compares against `CROSS_RUN_FAIL_THRESHOLD` and `CROSS_ITER_FAILURE_RATE_THRESHOLD` environment variables.

Example: generate a small custom badge (green with "healthy"):

```sh
python3 scripts/contract/generate_status_badge.py --out ci/flakiness/cross/status.svg --label parity --ok-text healthy --ok-color "#0b0" --width 140
```

Example: the published live dashboard URL will be:

```
https://<your-org-or-user>.github.io/<repo>/parity-cross/dashboard.html
```

Slack notifications:

- If `secrets.SLACK_WEBHOOK` is set in the workflow, the weekly summary job will post a short message with failure counts and cross-instance metrics. If the cross thresholds are exceeded, the message will be prefixed with an alert emoji and include the cross summary.
- The local collector can also post an immediate Slack notification when thresholds are exceeded if the `SLACK_WEBHOOK` environment variable is set locally when running `collect_local_cross_runs.sh` or `collect_flakiness.sh`.

Example (local):

```sh
CROSS_RUN_FAIL_THRESHOLD=2 CROSS_ITER_FAILURE_RATE_THRESHOLD=0.1 ./scripts/contract/collect_local_cross_runs.sh --copy
```

Example (local publish):

```sh
PUBLISH_DASHBOARD=true AWS_S3_BUCKET=my-bucket ./scripts/contract/collect_local_cross_runs.sh --copy
```

Example (CI): set `PUBLISH_DASHBOARD=true` and `AWS_S3_BUCKET` or `GITHUB_PAGES_REPO` in the scheduled workflow step environment or secrets.

- Attempt local repro with `./scripts/contract/run_parity_locally.sh --no-cleanup` and run `./scripts/contract/run_cross_instance_locally.sh --no-cleanup` to reproduce; attach `ci/webprofile-parity-<TIMESTAMP>.tar.gz` to the issue.
