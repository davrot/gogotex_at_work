#!/usr/bin/env bash
set -euo pipefail

# Collect recent webprofile-parity workflow runs' flakiness.json artifacts and produce an aggregate summary
# Requires: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo)

REPO=${GITHUB_REPOSITORY:?}
TOKEN=${GITHUB_TOKEN:?}
OUT_DIR=${OUT_DIR:-ci/flakiness/collected}
mkdir -p "$OUT_DIR"

# get workflow runs for the webprofile-parity workflow
runs_url="https://api.github.com/repos/${REPO}/actions/workflows/webprofile-parity.yml/runs?per_page=50"
runs_json=$(curl -sS -H "Authorization: token ${TOKEN}" "$runs_url")
run_ids=$(echo "$runs_json" | jq -r '.workflow_runs[] | select(.created_at >= "'$(date -I -d '30 days ago')'" ) | .id')

for rid in $run_ids; do
  echo "Processing run $rid"
  art_url="https://api.github.com/repos/${REPO}/actions/runs/${rid}/artifacts"
  arts=$(curl -sS -H "Authorization: token ${TOKEN}" "$art_url")
  # find artifact named webprofile-flakiness or any artifact and try to extract flakiness.json
  echo "$arts" | jq -r '.artifacts[] | "\(.id)\t\(.name)\t\(.archive_download_url)"' | while IFS=$'\t' read -r aid aname aurl; do
    echo "Found artifact $aname ($aid)"
    tmpzip="/tmp/artifact_${rid}_${aid}.zip"
    curl -sL -H "Authorization: token ${TOKEN}" -o "$tmpzip" "$aurl"
    tmpdir="/tmp/artifact_${rid}_${aid}"
    mkdir -p "$tmpdir"
    unzip -q "$tmpzip" -d "$tmpdir" || true
    found=$(find "$tmpdir" -type f -name 'flakiness.json' -print -quit || true)
    if [ -n "$found" ]; then
      echo "Extracted flakiness.json from $aname"
      cp "$found" "$OUT_DIR/run_${rid}.json"
      # continue: also look for cross-instance results
    fi
    found_cross=$(find "$tmpdir" -type f -name 'cross-instance-results.json' -print -quit || true)
    if [ -n "$found_cross" ]; then
      echo "Extracted cross-instance results from $aname"
      cp "$found_cross" "$OUT_DIR/run_${rid}_cross.json"
    fi
    # also capture any cross-instance raw outputs for manual triage
    found_cross_out=$(find "$tmpdir" -type f -name 'cross-instance-iter-*.out' -print -quit || true)
    if [ -n "$found_cross_out" ]; then
      mkdir -p "$OUT_DIR/raw/$rid"
      find "$tmpdir" -type f -name 'cross-instance-iter-*.out' -exec cp {} "$OUT_DIR/raw/$rid/" \; || true
    fi
  done
done

# Aggregate
mkdir -p ci/flakiness
jq -s '.' $OUT_DIR/*.json > ci/flakiness/aggregate.json || echo '[]' > ci/flakiness/aggregate.json

# Aggregate cross-instance results if present
mkdir -p ci/flakiness/cross
cross_files=$(ls -1 $OUT_DIR/*_cross.json 2>/dev/null || true)
if [ -n "$cross_files" ]; then
  jq -s '.' $OUT_DIR/*_cross.json > ci/flakiness/cross/aggregate_cross.json || echo '[]' > ci/flakiness/cross/aggregate_cross.json
  # compute summary counts
  python3 - <<PY
import json
agg=json.load(open('ci/flakiness/cross/aggregate_cross.json'))
# agg is list of per-run cross-instance results (each is array of iterations)
# For each run, determine if any iteration failed
run_failures = sum(1 for run in agg if any(not it.get('success',False) for it in run))
run_total = len(agg)
iter_total = sum(len(run) for run in agg)
iter_failures = sum(sum(1 for it in run if not it.get('success',False)) for run in agg)
print('cross_runs=%d run_failures=%d iter_total=%d iter_failures=%d' % (run_total, run_failures, iter_total, iter_failures))
with open('ci/flakiness/cross/report.txt','w') as f:
    f.write('cross_runs=%d\n' % run_total)
    f.write('run_failures=%d\n' % run_failures)
    f.write('iter_total=%d\n' % iter_total)
    f.write('iter_failures=%d\n' % iter_failures)
PY
else
  echo '[]' > ci/flakiness/cross/aggregate_cross.json
fi

# Make a simple textual report
python3 - <<PY
import json
from pathlib import Path
agg=json.load(open('ci/flakiness/aggregate.json'))
count=len(agg)
success=sum(1 for x in agg if x.get('success')==True)
fail=count-success
print('Collected %d flakiness reports: %d success, %d failure' % (count, success, fail))
with open('ci/flakiness/report.txt','w') as f:
    f.write('Collected %d reports\n' % count)
    f.write('success=%d\n' % success)
    f.write('failure=%d\n' % fail)

# append cross-instance summary if present
cross_report=''
if Path('ci/flakiness/cross/report.txt').exists():
    cross_report = open('ci/flakiness/cross/report.txt').read()
    f.write('\n# cross-instance summary\n')
    f.write(cross_report)
    print('Cross-instance summary appended')
PY

echo "Wrote ci/flakiness/aggregate.json and ci/flakiness/report.txt"