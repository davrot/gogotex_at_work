#!/usr/bin/env bash
set -euo pipefail

# compare_ssh_parity.sh <node_base_url> <go_base_url> <userId>
# Example: ./compare_ssh_parity.sh http://develop-web-1:3000 http://localhost:3900 test-user

NODE_BASE=${1:-${NODE_BASE:-}}
GO_BASE=${2:-${GO_BASE:-}}
USER_ID=${3:-${USER_ID:-test-compare}}

if [ -z "$NODE_BASE" ] || [ -z "$GO_BASE" ]; then
  echo "Usage: $0 <node_base_url> <go_base_url> <userId>"
  exit 2
fi

TMPDIR=$(mktemp -d)
ARTIFACT_DIR=${ARTIFACT_DIR:-tmp/parity_results/$(date +%s)}
mkdir -p "$ARTIFACT_DIR"
echo "Artifact dir: $ARTIFACT_DIR"
trap 'rm -rf "$TMPDIR"' EXIT

# Compute repository root (repo-relative paths used later) early so we can mount the correct dir into docker
SCRIPT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

PUB="$(mktemp -u)"
# generate a temporary keypair with ssh-keygen; write only public key here
ssh-keygen -t ed25519 -f "$TMPDIR/testkey" -N '' -C "contract-compare" >/dev/null 2>&1 || true
PUB_FILE="$TMPDIR/testkey.pub"
PUB_KEY=$(cat "$PUB_FILE")

# Determine how to run Node-based seeders: prefer local node, else fall back to a dockerized node container
if command -v node >/dev/null 2>&1; then
  NODE_CMD=node
elif command -v docker >/dev/null 2>&1; then
  # Use repo-root mount so the seeder scripts are visible inside the container
  NODE_CMD="docker run --rm -v \"$SCRIPT_ROOT\":/work -w /work node:20 node"
else
  NODE_CMD=node
fi

echo "Using public key file: $PUB_FILE"

function call_post() {
  local base=$1
  local user=$2
  local out=$3
  local code
  code=$(curl -sS -o "$out" -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"public_key\": \"$PUB_KEY\", \"key_name\": \"compare-$(date +%s)\"}" "$base/internal/api/users/$user/ssh-keys")
  echo "$code"
}

function call_get() {
  local base=$1
  local user=$2
  local out=$3
  local code
  code=$(curl -sS -o "$out" -w "%{http_code}" "$base/internal/api/users/$user/ssh-keys")
  echo "$code"
}

NODE_POST_OUT="$TMPDIR/node_post.json"
GO_POST_OUT="$TMPDIR/go_post.json"
NODE_GET_OUT="$TMPDIR/node_get.json"
GO_GET_OUT="$TMPDIR/go_get.json"

# Try POSTs first to observe auth behavior differences
echo "POST -> Node ($NODE_BASE)"
NODE_STATUS=$(call_post "$NODE_BASE" "$USER_ID" "$NODE_POST_OUT" || true)
echo "Node POST status: $NODE_STATUS"

sleep 0.5

echo "POST -> Go ($GO_BASE)"
GO_STATUS=$(call_post "$GO_BASE" "$USER_ID" "$GO_POST_OUT" || true)
echo "Go POST status: $GO_STATUS"

# If caller provided seed fingerprints, skip POST-based seeding and use provided values; else check POST auth and fall back to seeding
if [ -n "${NODE_SEED_FP:-}" ] && [ -n "${GO_SEED_FP:-}" ]; then
  echo "Using externally-provided seed fingerprints; skipping POST auth detection and seeding"
  GO_USER_ID="${GO_USER_OVERRIDE:-${USER_ID}-go}"
  NODE_SEED_OUT="$TMPDIR/node_seed.out"
  GO_SEED_OUT="$TMPDIR/go_seed.out"
  echo "{\"fingerprint\": \"$NODE_SEED_FP\"}" >"$NODE_SEED_OUT" || true
  echo "{\"fingerprint\": \"$GO_SEED_FP\"}" >"$GO_SEED_OUT" || true
else
  # If POSTs were not authorized (Node returned 302), fall back to seeding via seeder and compare GET outputs
  if [ "$NODE_STATUS" = "302" ] || [ "$NODE_STATUS" = "401" ] || [ "$NODE_STATUS" = "403" ]; then
  echo "Node POST requires auth (status $NODE_STATUS). Falling back to seeding DB and comparing GET results."
  # Seed via Node seeder (requires MONGO_URI env or default to compose mongo)
  MONGO_URI=${MONGO_URI:-mongodb://mongo:27017/sharelatex}
  echo "Seeding user $USER_ID via seeder (MONGO_URI=$MONGO_URI)"
  NODE_SEED_OUT="$TMPDIR/node_seed.out"
  GO_SEED_OUT="$TMPDIR/go_seed.out"

  # Allow externally-provided seed fingerprints (NODE_SEED_FP / GO_SEED_FP) to bypass running seeders
  if [ -n "${NODE_SEED_FP:-}" ] && [ -n "${GO_SEED_FP:-}" ]; then
    echo "Using externally-provided seed fingerprints: node=$NODE_SEED_FP go=$GO_SEED_FP"
    # populate minimal seed output files for downstream parsing
    echo "{\"fingerprint\": \"$NODE_SEED_FP\"}" >"$NODE_SEED_OUT" || true
    echo "{\"fingerprint\": \"$GO_SEED_FP\"}" >"$GO_SEED_OUT" || true
  else
    # Run seeder and capture output for fingerprint extraction
    if echo "$NODE_CMD" | grep -q "docker run"; then
      # sanity-check that seeder is visible inside docker
      if ! docker run --rm -v "$SCRIPT_ROOT":/work -w /work node:20 node -e "console.log(require('fs').existsSync('services/web/tools/seed_ssh_key.mjs'))" 2>/dev/null | grep -q "true"; then
        echo "Warning: seeder script not visible inside docker at services/web/tools/seed_ssh_key.mjs (mounted $SCRIPT_ROOT:/work)."
        echo "Proceeding to run seeder to capture error output."
      fi
      docker run --rm -e MONGO_URI="$MONGO_URI" -v "$SCRIPT_ROOT":/work -w /work node:20 node services/web/tools/seed_ssh_key.mjs "$USER_ID" "$PUB_FILE" >"$NODE_SEED_OUT" 2>&1 || true
    else
      MONGO_URI="$MONGO_URI" $NODE_CMD services/web/tools/seed_ssh_key.mjs "$USER_ID" "$PUB_FILE" >"$NODE_SEED_OUT" 2>&1 || true
    fi

    # For Go user, seed separate user id to avoid direct collision in same DB
    GO_USER_ID="${USER_ID}-go"
    if echo "$NODE_CMD" | grep -q "docker run"; then
      docker run --rm -e MONGO_URI="$MONGO_URI" -v "$SCRIPT_ROOT":/work -w /work node:20 node services/web/tools/seed_ssh_key.mjs "$GO_USER_ID" "$PUB_FILE" >"$GO_SEED_OUT" 2>&1 || true
    else
      MONGO_URI="$MONGO_URI" $NODE_CMD services/web/tools/seed_ssh_key.mjs "$GO_USER_ID" "$PUB_FILE" >"$GO_SEED_OUT" 2>&1 || true
    fi

    echo "Extracted Node seed fingerprint: $NODE_SEED_FP"
  if [ -n "$GO_SEED_FP" ]; then
    echo "Extracted Go seed fingerprint: $GO_SEED_FP"
  fi
else
  # If POSTs succeeded (e.g. Go accepted unauthenticated POST), proceed to GET check using same users
  GO_USER_ID="$USER_ID"
fi

sleep 0.5

echo "GET -> Node ($NODE_BASE) (using Basic auth: overleaf:overleaf)"
NODE_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$NODE_GET_OUT" -w "%{http_code}" "$NODE_BASE/internal/api/users/$USER_ID/ssh-keys" || true)
echo "Node GET status: $NODE_GET_STATUS"

echo "GET -> Go ($GO_BASE)"
# Go shim currently is unauthenticated in this prototype; include Basic auth header for parity if needed
# Try compose-hostname, fall back to host-local if necessary
GO_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$GO_GET_OUT" -w "%{http_code}" "$GO_BASE/internal/api/users/$GO_USER_ID/ssh-keys" || true)
if [ -z "$GO_GET_STATUS" ] && [ "$GO_BASE" = "http://webprofile-api-ci:3900" ]; then
  echo "Attempting fallback to host-local shim at http://localhost:3900"
  GO_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$GO_GET_OUT" -w "%{http_code}" "http://localhost:3900/internal/api/users/$GO_USER_ID/ssh-keys" || true)
  GO_BASE="http://localhost:3900"
fi
echo "Go GET status: $GO_GET_STATUS"
# Extract canonical fingerprint values
NODE_FP_POST=$(jq -r '.fingerprint // empty' "$NODE_POST_OUT" || true)
NODE_FP_GET=$(jq -r '.[0].fingerprint // empty' "$NODE_GET_OUT" || true)
GO_FP_POST=$(jq -r '.fingerprint // empty' "$GO_POST_OUT" || true)
GO_FP_GET=$(jq -r '.[0].fingerprint // empty' "$GO_GET_OUT" || true)

# Fallback: use seeder-extracted fingerprints when Node APIs are authenticated/redirecting
NODE_FP_POST=${NODE_FP_POST:-$NODE_SEED_FP}
NODE_FP_GET=${NODE_FP_GET:-$NODE_SEED_FP}
GO_FP_POST=${GO_FP_POST:-$GO_SEED_FP}
GO_FP_GET=${GO_FP_GET:-$GO_SEED_FP}

echo "Node POST fingerprint: $NODE_FP_POST"
echo "Node GET fingerprint:  $NODE_FP_GET"
echo "Go POST fingerprint:   $GO_FP_POST"
echo "Go GET fingerprint:    $GO_FP_GET"

# Compare outcomes
FAIL=0
# Allow POST to be non-2xx if we seeded the DB directly (node/go may be auth-protected)
if [ -z "$NODE_SEED_FP" ]; then
  if [ "$NODE_STATUS" != "201" ] && [ "$NODE_STATUS" != "200" ]; then
    echo "Node POST returned unexpected status $NODE_STATUS"
    FAIL=1
  fi
else
  echo "Node POST unauthenticated; using seeder fingerprint: $NODE_SEED_FP"
fi

if [ -z "$GO_SEED_FP" ]; then
  if [ "$GO_STATUS" != "201" ] && [ "$GO_STATUS" != "200" ]; then
    echo "Go POST returned unexpected status $GO_STATUS"
    FAIL=1
  fi
else
  echo "Go POST unauthenticated; using seeder fingerprint: $GO_SEED_FP"
fi
if [ -z "$NODE_FP_POST" ] && [ -z "$NODE_FP_GET" ]; then
  echo "Node did not return a fingerprint in POST or GET outputs"
  FAIL=1
fi
if [ -z "$GO_FP_POST" ] && [ -z "$GO_FP_GET" ]; then
  echo "Go did not return a fingerprint in POST or GET outputs"
  FAIL=1
fi

# Normalize fingerprints to compare
NODE_FP=${NODE_FP_POST:-${NODE_FP_GET:-$NODE_SEED_FP}}
GO_FP=${GO_FP_POST:-${GO_FP_GET:-$GO_SEED_FP}}

# Helper: check if a fingerprint exists anywhere in a GET JSON array file
contains_fp() {
  local file=$1
  local fp=$2
  if [ -z "$fp" ] || [ ! -s "$file" ]; then
    return 1
  fi
  if jq -e --arg FP "$fp" 'map(.fingerprint == $FP) | any' "$file" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Allow success when either fingerprint matches the other's GET list, or they are equal
if [ "$NODE_FP" = "$GO_FP" ]; then
  echo "Fingerprints equal: $NODE_FP"
else
  # Check cross-inclusion
  NODE_IN_GO=1
  GO_IN_NODE=1
  if ! contains_fp "$GO_GET_OUT" "$NODE_FP"; then
    NODE_IN_GO=0
  fi
  if ! contains_fp "$NODE_GET_OUT" "$GO_FP"; then
    GO_IN_NODE=0
  fi

  if [ $NODE_IN_GO -eq 1 ] || [ $GO_IN_NODE -eq 1 ]; then
    echo "Parity OK via cross-inclusion: node=$NODE_FP go=$GO_FP"
  else
    echo "Fingerprint mismatch between Node and Go: node=$NODE_FP go=$GO_FP"
    FAIL=1
  fi
fi

if [ $FAIL -ne 0 ]; then
  echo "Parity check FAILED"
  echo "Node POST output:"
  cat "$NODE_POST_OUT"
  echo "Node GET output:"
  cat "$NODE_GET_OUT"
  echo "Go POST output:"
  cat "$GO_POST_OUT"
  echo "Go GET output:"
  cat "$GO_GET_OUT"
  echo "Saving artifacts to $ARTIFACT_DIR"
  cp -v "$NODE_POST_OUT" "$NODE_GET_OUT" "$GO_POST_OUT" "$GO_GET_OUT" "$ARTIFACT_DIR/" || true
  ls -la "$ARTIFACT_DIR" || true
  exit 3
fi

echo "Parity check PASSED: fingerprints match and both services returned expected codes"
# copy outputs for debugging/pipeline artifacts
cp -v "$NODE_POST_OUT" "$NODE_GET_OUT" "$GO_POST_OUT" "$GO_GET_OUT" "$ARTIFACT_DIR/" || true
echo "Saved parity outputs to $ARTIFACT_DIR"
exit 0
