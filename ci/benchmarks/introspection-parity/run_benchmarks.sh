#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <node_base> <go_base> <out_dir>" >&2
  exit 2
fi
NODE_BASE="$1"
GO_BASE="$2"
OUTDIR="$3"
mkdir -p "$OUTDIR"

# small helper to measure N requests
measure() {
  local base="$1"; local label="$2"; local out="$3"
  local N=50
  printf '{"label":"%s","n":%d,"times_ms":[\n' "$label" "$N" > "$out"
  for i in $(seq 1 $N); do
    start=$(date +%s%3N)
    # introspect with a nonsense token to get a fast response
    curl -sS -w '\\n' -o /dev/null -X POST -H 'Content-Type: application/json' -d '{"token":"bogus"}' "$base/internal/api/tokens/introspect" >/dev/null 2>&1 || true
    end=$(date +%s%3N)
    dt=$((end - start))
    printf "%s" "$dt" >> "$out"
    if [ $i -lt $N ]; then printf ',\n' >> "$out"; fi
  done
  printf '\n]}' >> "$out"
}

measure "$NODE_BASE" "node" "$OUTDIR/node.json"
measure "$GO_BASE" "go" "$OUTDIR/go.json"

# produce a short summary
python3 - <<PY
import json
n=json.load(open('$OUTDIR/node.json'))
g=json.load(open('$OUTDIR/go.json'))
import statistics
print('node: n=%d median=%s p95=%s' % (n['n'], statistics.median(n['times_ms']), max(n['times_ms'])))
print('go:   n=%d median=%s p95=%s' % (g['n'], statistics.median(g['times_ms']), max(g['times_ms'])))
with open('$OUTDIR/summary.txt','w') as f:
    f.write('node median=%s\n' % statistics.median(n['times_ms']))
    f.write('go median=%s\n' % statistics.median(g['times_ms']))
PY

echo "Benchmarks written to $OUTDIR"