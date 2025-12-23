# Parity runbook

If automated parity runs detect failures, follow these steps:

1. Check CI artifacts: `webprofile-parity-artifacts` (logs + node.parity.json + analysis.json).
2. Inspect `ci/webprofile-parity/node.parity.json` and `ci/webprofile-parity/test.parity.out` for stack traces and last responses.
3. Check `ci/webprofile-parity/webprofile.log` and `ci/webprofile-parity/mongo.log` for container logs.
4. If failure is transient (rerunner succeeded), note flakiness report in `ci/flakiness/` for the run; consider adding a regression test if failure reproduced more than 3 times.
5. For repeated scheduled failures, the workflow will create an issue automatically; add triage labels and assign maintainers.

Slack alerting:

- Slack notifications are optional. If `secrets.SLACK_WEBHOOK` is set, a failure will send a short summary message to the configured webhook.
- Thresholds: we consider >3 consecutive scheduled failures a 'major' alert; see `ci/flakiness` artifacts for counts.

Runbook for maintainers:

- For revocation immediacy failures, collect a packet: `node.parity.json`, `test.parity.out`, `webprofile.log`, `mongo.log`, and the failing request/response pairs (if present).
- Attempt local repro with `./scripts/contract/run_parity_locally.sh --no-cleanup` and attach `ci/webprofile-parity-<TIMESTAMP>.tar.gz` to the issue.
