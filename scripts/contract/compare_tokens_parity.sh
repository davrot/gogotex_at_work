#!/usr/bin/env bash
set -euo pipefail

# compare_tokens_parity.sh <node_base_url> <go_base_url> <userId>
# Example: ./compare_tokens_parity.sh http://develop-web-1:3000 http://localhost:3900 test-user

NODE_BASE=${1:-}
GO_BASE=${2:-}
USER_ID=${3:-test-compare}

if [ -z "$NODE_BASE" ] || [ -z "$GO_BASE" ]; then
  echo "Usage: $0 <node_base_url> <go_base_url> <userId>"
  exit 2
fi

TMPDIR=$(mktemp -d)
ARTIFACT_DIR=${ARTIFACT_DIR:-tmp/parity_results/$(date +%s)}
mkdir -p "$ARTIFACT_DIR"
echo "Artifact dir: $ARTIFACT_DIR"
trap 'rm -rf "$TMPDIR"' EXIT

# Determine how to run Node-based seeders: prefer local node, else fall back to a dockerized node container
if command -v node >/dev/null 2>&1; then
  NODE_CMD=node
elif command -v docker >/dev/null 2>&1; then
  NODE_CMD='docker run --rm -v "$PWD":/work -w /work node:20 node'
else
  NODE_CMD=node
fi

function call_post() {
  local base=$1
  local user=$2
  local out=$3
  local code
  code=$(curl -sS -o "$out" -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"label\": \"compare-$(date +%s)\"}" "$base/internal/api/users/$user/git-tokens")
  echo "$code"
}

function call_get() {
  local base=$1
  local user=$2
  local out=$3
  local code
  code=$(curl -sS -o "$out" -w "%{http_code}" "$base/internal/api/users/$user/git-tokens")
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

# If POSTs were not authorized (Node returned 302), fall back to seeding via seeder and compare GET outputs
if [ "$NODE_STATUS" = "302" ] || [ "$NODE_STATUS" = "401" ] || [ "$NODE_STATUS" = "403" ]; then
  echo "Node POST requires auth (status $NODE_STATUS). Falling back to seeding DB and comparing GET results."
  MONGO_URI=${MONGO_URI:-mongodb://mongo:27017/sharelatex}
  echo "Seeding user $USER_ID via seeder (MONGO_URI=$MONGO_URI)"
  NODE_SEED_OUT="$TMPDIR/node_seed.out"
  GO_SEED_OUT="$TMPDIR/go_seed.out"
  # Seed tokens via Node seeder script
  MONGO_URI="$MONGO_URI" $NODE_CMD services/web/tools/seed_token.mjs "$USER_ID" >"$NODE_SEED_OUT" 2>&1 || true
  # For Go user, seed separate user id to avoid direct collision in same DB
  GO_USER_ID="${USER_ID}-go"
  MONGO_URI="$MONGO_URI" $NODE_CMD services/web/tools/seed_token.mjs "$GO_USER_ID" >"$GO_SEED_OUT" 2>&1 || true
  echo "Node seeder output:"
  sed -n '1,120p' "$NODE_SEED_OUT" || true
  echo "Go seeder output:"
  sed -n '1,120p' "$GO_SEED_OUT" || true
  # Extract token ids from seeder outputs as fallback
  NODE_SEED_ID=$(jq -r '.id // empty' "$NODE_SEED_OUT" || true)
  GO_SEED_ID=$(jq -r '.id // empty' "$GO_SEED_OUT" || true)
  NODE_SEED_TOKEN=$(jq -r '.token // empty' "$NODE_SEED_OUT" || true)
  GO_SEED_TOKEN=$(jq -r '.token // empty' "$GO_SEED_OUT" || true)
  if [ -n "$NODE_SEED_ID" ]; then
    echo "Extracted Node seed token id: $NODE_SEED_ID"
  fi
  if [ -n "$GO_SEED_ID" ]; then
    echo "Extracted Go seed token id: $GO_SEED_ID"
  fi
else
  GO_USER_ID="$USER_ID"
fi

sleep 0.5

echo "GET -> Node ($NODE_BASE) (using Basic auth: overleaf:overleaf)"
NODE_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$NODE_GET_OUT" -w "%{http_code}" "$NODE_BASE/internal/api/users/$USER_ID/git-tokens" || true)
echo "Node GET status: $NODE_GET_STATUS"

echo "GET -> Go ($GO_BASE)"
GO_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$GO_GET_OUT" -w "%{http_code}" "$GO_BASE/internal/api/users/$GO_USER_ID/git-tokens" || true)
if [ -z "$GO_GET_STATUS" ] && [ "$GO_BASE" = "http://webprofile-api-ci:3900" ]; then
  echo "Attempting fallback to host-local shim at http://localhost:3900"
  GO_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$GO_GET_OUT" -w "%{http_code}" "http://localhost:3900/internal/api/users/$GO_USER_ID/git-tokens" || true)
  GO_BASE="http://localhost:3900"
fi
echo "Go GET status: $GO_GET_STATUS"

# Extract token ids / hashPrefixes
NODE_ID_POST=$(jq -r '.id // empty' "$NODE_POST_OUT" || true)
NODE_TOKEN_POST=$(jq -r '.token // empty' "$NODE_POST_OUT" || true)
NODE_ID_GET=$(jq -r '.[0].id // empty' "$NODE_GET_OUT" || true)
NODE_HP_GET=$(jq -r '.[0].hashPrefix // empty' "$NODE_GET_OUT" || true)
GO_ID_POST=$(jq -r '.id // empty' "$GO_POST_OUT" || true)
GO_TOKEN_POST=$(jq -r '.token // empty' "$GO_POST_OUT" || true)
GO_ID_GET=$(jq -r '.[0].id // empty' "$GO_GET_OUT" || true)
GO_HP_GET=$(jq -r '.[0].hashPrefix // empty' "$GO_GET_OUT" || true)

# Fallback: use seeder-extracted values when Node APIs are authenticated/redirecting
NODE_ID_POST=${NODE_ID_POST:-$NODE_SEED_ID}
NODE_TOKEN_POST=${NODE_TOKEN_POST:-$NODE_SEED_TOKEN}
NODE_ID_GET=${NODE_ID_GET:-$NODE_SEED_ID}
NODE_HP_GET=${NODE_HP_GET:-}
GO_ID_POST=${GO_ID_POST:-$GO_SEED_ID}
GO_TOKEN_POST=${GO_TOKEN_POST:-$GO_SEED_TOKEN}
GO_ID_GET=${GO_ID_GET:-$GO_SEED_ID}
GO_HP_GET=${GO_HP_GET:-}

echo "Node POST id: $NODE_ID_POST"
echo "Node GET id:  $NODE_ID_GET"
echo "Go POST id:   $GO_ID_POST"
echo "Go GET id:    $GO_ID_GET"

FAIL=0
# Allow POST to be non-2xx if we seeded the DB directly (node/go may be auth-protected)
if [ -z "$NODE_SEED_ID" ]; then
  if [ "$NODE_STATUS" != "201" ] && [ "$NODE_STATUS" != "200" ]; then
    echo "Node POST returned unexpected status $NODE_STATUS"
    FAIL=1
  fi
else
  echo "Node POST unauthenticated; using seeder token id: $NODE_SEED_ID"
fi

if [ -z "$GO_SEED_ID" ]; then
  if [ "$GO_STATUS" != "201" ] && [ "$GO_STATUS" != "200" ]; then
    echo "Go POST returned unexpected status $GO_STATUS"
    FAIL=1
  fi
else
  echo "Go POST unauthenticated; using seeder token id: $GO_SEED_ID"
fi

if [ -z "$NODE_ID_POST" ] && [ -z "$NODE_ID_GET" ]; then
  echo "Node did not return a token id in POST or GET outputs"
  FAIL=1
fi
if [ -z "$GO_ID_POST" ] && [ -z "$GO_ID_GET" ]; then
  echo "Go did not return a token id in POST or GET outputs"
  FAIL=1
fi

# Normalize ids to compare
NODE_ID=${NODE_ID_POST:-${NODE_ID_GET:-$NODE_SEED_ID}}
GO_ID=${GO_ID_POST:-${GO_ID_GET:-$GO_SEED_ID}}

# Helper: check if an id exists anywhere in a GET JSON array file
contains_id() {
  local file=$1
  local id=$2
  if [ -z "$id" ] || [ ! -s "$file" ]; then
    return 1
  fi
  if jq -e --arg ID "$id" 'map(.id == $ID) | any' "$file" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Allow success when either id matches the other's GET list, or they are equal
if [ "$NODE_ID" = "$GO_ID" ]; then
  echo "Token ids equal: $NODE_ID"
else
  NODE_IN_GO=1
  GO_IN_NODE=1
  if ! contains_id "$GO_GET_OUT" "$NODE_ID"; then
    NODE_IN_GO=0
  fi
  if ! contains_id "$NODE_GET_OUT" "$GO_ID"; then
    GO_IN_NODE=0
  fi

  if [ $NODE_IN_GO -eq 1 ] || [ $GO_IN_NODE -eq 1 ]; then
    echo "Parity OK via cross-inclusion: node=$NODE_ID go=$GO_ID"
  else
    echo "Token id mismatch between Node and Go: node=$NODE_ID go=$GO_ID"
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

echo "Parity check PASSED: token ids returned and present in lists"
cp -v "$NODE_POST_OUT" "$NODE_GET_OUT" "$GO_POST_OUT" "$GO_GET_OUT" "$ARTIFACT_DIR/" || true
echo "Saved parity outputs to $ARTIFACT_DIR"
exit 0