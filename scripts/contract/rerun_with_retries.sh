#!/usr/bin/env bash
set -euo pipefail

# Usage: rerun_with_retries.sh <max_attempts> <output_dir> -- <command...>
# Example: rerun_with_retries.sh 3 ci/flakiness -- node scripts/contract/node_parity.js

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <max_attempts> <output_dir> -- <command...>" >&2
  exit 2
fi
MAX_ATTEMPTS="$1"
OUTDIR="$2"
shift 2
if [ "$1" != "--" ]; then
  echo "expected -- before command" >&2
  exit 2
fi
shift 1
CMD=("$@")

mkdir -p "$OUTDIR"
REPORT_FILE="$OUTDIR/flakiness.json"

attempt=0
start_ts=$(date +%s)
success=false
records=()

while [ $attempt -lt $MAX_ATTEMPTS ]; do
  attempt=$((attempt+1))
  echo "Attempt #$attempt: ${CMD[*]}"
  attempt_start=$(date +%s%3N)
  set +e
  "${CMD[@]}"
  rc=$?
  set -e
  attempt_end=$(date +%s%3N)
  duration=$((attempt_end - attempt_start))
  records+=("{\"attempt\":$attempt,\"rc\":$rc,\"duration_ms\":$duration}")
  if [ $rc -eq 0 ]; then
    success=true
    break
  fi
  echo "Command failed with rc=$rc, retrying..."
  sleep 2
done

end_ts=$(date +%s)

# Write flakiness report
cat > "$REPORT_FILE" <<JSON
{
  "start_ts": ${start_ts},
  "end_ts": ${end_ts},
  "success": ${success},
  "attempts": [
    $(printf "%s\n" "${records[@]}" | sed -e '$!s/$/,/' -e 's/^/    /')
  ]
}
JSON

echo "Wrote flakiness report to $REPORT_FILE"

# Build a tiny HTML dashboard for quick inspection
mkdir -p "$OUTDIR/ui"
cat > "$OUTDIR/ui/index.html" <<HTML
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Flakiness report</title></head>
<body>
<h1>Flakiness report</h1>
<pre id="json">$(cat "$REPORT_FILE" | sed 's/&/\&amp;/g' | sed 's/</\&lt;/g' | sed "s/\"/\\\"/g")</pre>
</body>
</html>
HTML

echo "Wrote dashboard to $OUTDIR/ui/index.html"

if [ "$success" = true ]; then
  exit 0
else
  exit 1
fi