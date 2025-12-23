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
      break
    fi
  done
done

# Aggregate
mkdir -p ci/flakiness
jq -s '.' $OUT_DIR/*.json > ci/flakiness/aggregate.json || echo '[]' > ci/flakiness/aggregate.json

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
PY

echo "Wrote ci/flakiness/aggregate.json and ci/flakiness/report.txt"