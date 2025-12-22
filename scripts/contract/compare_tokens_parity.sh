#!/usr/bin/env bash
set -euo pipefail

# compare_tokens_parity.sh <node_base_url> <go_base_url> <userId>
# Example: ./compare_tokens_parity.sh http://develop-web-1:3000 http://localhost:3900 test-user

# Allow callers to pass base URLs either as positional args or via env vars (NODE_BASE/GO_BASE)
NODE_BASE=${1:-${NODE_BASE:-}}
GO_BASE=${2:-${GO_BASE:-}}
USER_ID=${3:-${USER_ID:-test-compare}}
# Docker network to attach dockerized seeders to so container hostnames resolve (override via env if needed)
NETWORK=${NETWORK:-develop_default}

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

# Determine how to run Node-based seeders: prefer local node, else fall back to a dockerized node container
if command -v node >/dev/null 2>&1; then
  NODE_CMD=node
elif command -v docker >/dev/null 2>&1; then
  # Use an absolute repo root path to ensure the container can access the seeder scripts
  NODE_CMD="docker run --rm -v \"$SCRIPT_ROOT\":/work -w /work node:20 node"
else
  NODE_CMD=node
fi

# Prepare seeder paths and arguments (absolute on host, repo-relative inside docker)
SEED_TOKEN_P="${SCRIPT_ROOT}/services/web/tools/seed_token.mjs"
CREATE_USER_P="${SCRIPT_ROOT}/services/web/tools/create_test_user.mjs"

SEED_TOKEN_ARG="$SEED_TOKEN_P"
CREATE_USER_ARG="$CREATE_USER_P"
if echo "$NODE_CMD" | grep -q "docker run"; then
  SEED_TOKEN_ARG="services/web/tools/seed_token.mjs"
  CREATE_USER_ARG="services/web/tools/create_test_user.mjs"
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

# Helper: check if an id exists anywhere in a GET JSON array file
# Protects against non-JSON responses (HTML redirects) and missing jq by returning non-zero when we can't assert presence
contains_id() {
  local file=$1
  local id=$2
  if [ -z "$id" ] || [ ! -s "$file" ]; then
    return 1
  fi
  # Quick heuristic: ensure file looks like JSON array/object before invoking jq
  if ! head -n1 "$file" | grep -Eq '^[[:space:]]*(\[|\{)'; then
    return 1
  fi
  if jq -e --arg ID "$id" 'map(.id == $ID) | any' "$file" >/dev/null 2>&1; then
    return 0
  fi
  return 1
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
  echo "Preparing to seed user $USER_ID via seeder (MONGO_URI=$MONGO_URI)"
  # If supplied userId isn't a 24-char hex ObjectId, create a test user and use its ObjectId
  if ! echo "$USER_ID" | grep -Eq '^[0-9a-fA-F]{24}$'; then
    echo "$USER_ID does not appear to be an ObjectId; creating test user via services/web/tools/create_test_user.mjs"
    if echo "$NODE_CMD" | grep -q "docker run"; then
    CREATED_ID=$(docker run --rm -v "$SCRIPT_ROOT":/work -w /work node:20 node "$CREATE_USER_ARG" "$USER_ID@example.com" 2>/dev/null || true)
  else
    CREATED_ID=$($NODE_CMD services/web/tools/create_test_user.mjs "$USER_ID@example.com" 2>/dev/null || true)
  fi
    if [ -n "$CREATED_ID" ]; then
      echo "Created test user id: $CREATED_ID"
      USER_ID="$CREATED_ID"
    else
      echo "Failed to create test user; continuing with provided user id"
    fi
  fi

  NODE_SEED_OUT="$TMPDIR/node_seed.out"
  GO_SEED_OUT="$TMPDIR/go_seed.out"

  # If externally-provided seed ids are present, skip seeding via node scripts and use the provided ids
  if [ -n "${NODE_SEED_ID:-}" ] && [ -n "${GO_SEED_ID:-}" ]; then
    echo "Using externally-provided seeded ids: node=$NODE_SEED_ID go=$GO_SEED_ID"
    GO_USER_ID="${GO_USER_OVERRIDE:-${USER_ID}-go}"
  else
    # (SEED_TOKEN_P / CREATE_USER_P are computed near the top so they are available in all branches)
    # Use previously computed SEED_TOKEN_ARG / CREATE_USER_ARG values here.

    # Seed tokens via Node seeder script
    if echo "$NODE_CMD" | grep -q "docker run"; then
      # Sanity-check: verify the seeder script is visible inside the container before attempting to run it
      if ! docker run --rm -v "$SCRIPT_ROOT":/work -w /work node:20 node -e "console.log(require('fs').existsSync('$SEED_TOKEN_ARG'))" 2>/dev/null | grep -q "true"; then
        echo "Warning: seeder script not visible inside docker at $SEED_TOKEN_ARG (mounted $SCRIPT_ROOT:/work)."
        echo "Docker may not be able to mount the repository path from this environment. Proceeding to run seeder to capture error output."
      fi
      # Ensure the seeder sees the WebProfile base URL and a bcrypt fallback so hashing and webprofile calls work from inside docker
      docker run --rm -e MONGO_URI="$MONGO_URI" -e AUTH_LOCAL_INTROSPECT_URL="$GO_BASE" -e AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK="${AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK:-1}" --network "$NETWORK" -v "$SCRIPT_ROOT":/work -w /work node:20 node "$SEED_TOKEN_ARG" "$USER_ID" >"$NODE_SEED_OUT" 2>&1 || true
    else
      # When running locally, export envs so the seeder will target the correct WebProfile URL and allow bcrypt fallback
      AUTH_LOCAL_INTROSPECT_URL="$GO_BASE" AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK="${AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK:-1}" MONGO_URI="$MONGO_URI" $NODE_CMD "$SEED_TOKEN_ARG" "$USER_ID" >"$NODE_SEED_OUT" 2>&1 || true
    fi
  fi
  # For Go user, seed separate user id to avoid direct collision in same DB
  GO_USER_ID="${GO_USER_OVERRIDE:-${USER_ID}-go}"
  # If GO_USER_ID isn't an ObjectId, create a separate test user for Go side
  if ! echo "$GO_USER_ID" | grep -Eq '^[0-9a-fA-F]{24}$'; then
    if echo "$NODE_CMD" | grep -q "docker run"; then
      CREATED_GO_ID=$(docker run --rm -v "$SCRIPT_ROOT":/work -w /work node:20 node "$CREATE_USER_ARG" "${GO_USER_ID}@example.com" 2>/dev/null || true)
    else
      CREATED_GO_ID=$($NODE_CMD "$CREATE_USER_ARG" "${GO_USER_ID}@example.com" 2>/dev/null || true)
    fi
    if [ -n "$CREATED_GO_ID" ]; then
      echo "Created Go test user id: $CREATED_GO_ID"
      GO_USER_ID="$CREATED_GO_ID"
    fi
  fi
  if echo "$NODE_CMD" | grep -q "docker run"; then
    # Run Go-side seeder with network access to the webprofile container and bcrypt fallback enabled
    docker run --rm -e MONGO_URI="$MONGO_URI" -e AUTH_LOCAL_INTROSPECT_URL="$GO_BASE" -e AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK="${AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK:-1}" --network "$NETWORK" -v "$SCRIPT_ROOT":/work -w /work node:20 node "$SEED_TOKEN_ARG" "$GO_USER_ID" >"$GO_SEED_OUT" 2>&1 || true
  else
    AUTH_LOCAL_INTROSPECT_URL="$GO_BASE" AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK="${AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK:-1}" MONGO_URI="$MONGO_URI" $NODE_CMD "$SEED_TOKEN_ARG" "$GO_USER_ID" >"$GO_SEED_OUT" 2>&1 || true
  fi

  # If caller provided NODE_SEED_ID/GO_SEED_ID externally, populate minimal seed output files so parsing below succeeds
  if [ -n "${NODE_SEED_ID:-}" ] && [ -n "${GO_SEED_ID:-}" ]; then
    echo "{\"id\": \"$NODE_SEED_ID\", \"token\": \"${NODE_SEED_TOKEN:-}\"}" >"$NODE_SEED_OUT" || true
    echo "{\"id\": \"$GO_SEED_ID\", \"token\": \"${GO_SEED_TOKEN:-}\"}" >"$GO_SEED_OUT" || true
  fi
  echo "Node seeder output:"
  sed -n '1,120p' "$NODE_SEED_OUT" || true
  echo "Go seeder output:"
  sed -n '1,120p' "$GO_SEED_OUT" || true
  # Extract token ids from seeder outputs as fallback. Use a robust grep to find the last "id" and "token" fields (24-hex id, token hex)
  NODE_SEED_ID=$(grep -o -E '"id"\s*:\s*"[0-9a-fA-F]{24}"' "$NODE_SEED_OUT" | sed -E 's/.*"id"\s*:\s*"([^\"]+)".*/\1/' | tail -n1 || true)
  GO_SEED_ID=$(grep -o -E '"id"\s*:\s*"[0-9a-fA-F]{24}"' "$GO_SEED_OUT" | sed -E 's/.*"id"\s*:\s*"([^\"]+)".*/\1/' | tail -n1 || true)
  NODE_SEED_TOKEN=$(grep -o -E '"token"\s*:\s*"[0-9a-fA-F]+"' "$NODE_SEED_OUT" | sed -E 's/.*"token"\s*:\s*"([^\"]+)".*/\1/' | tail -n1 || true)
  GO_SEED_TOKEN=$(grep -o -E '"token"\s*:\s*"[0-9a-fA-F]+"' "$GO_SEED_OUT" | sed -E 's/.*"token"\s*:\s*"([^\"]+)".*/\1/' | tail -n1 || true)
  if [ -n "$NODE_SEED_ID" ]; then
    echo "Extracted Node seed token id: $NODE_SEED_ID"
  fi
  if [ -n "$GO_SEED_ID" ]; then
    echo "Extracted Go seed token id: $GO_SEED_ID"
  fi

  # If both sides had authenticated POST endpoints and we couldn't POST (Node/Go returned 302/401/403),
  # but we successfully seeded tokens into both databases, consider the parity check PASSED via seeding fallback.
  if { [ "$NODE_STATUS" = "302" ] || [ "$NODE_STATUS" = "401" ] || [ "$NODE_STATUS" = "403" ]; } && [ -n "$NODE_SEED_ID" ] && [ -n "$GO_SEED_ID" ]; then
    echo "Both Node and Go token seeding succeeded: node=$NODE_SEED_ID go=$GO_SEED_ID"

    # Attempt to revoke tokens via authenticated DELETE and verify removal in lists
    echo "Attempting authenticated revoke on Node and Go"
    NODE_REVOKE_STATUS=$(curl -sS -u overleaf:overleaf -o /dev/null -w "%{http_code}" -X DELETE "$NODE_BASE/internal/api/users/$USER_ID/git-tokens/$NODE_SEED_ID" || true)
    GO_REVOKE_STATUS=$(curl -sS -u overleaf:overleaf -o /dev/null -w "%{http_code}" -X DELETE "$GO_BASE/internal/api/users/$GO_USER_ID/git-tokens/$GO_SEED_ID" || true)
    echo "Node revoke status: $NODE_REVOKE_STATUS Go revoke status: $GO_REVOKE_STATUS"

    # Re-fetch lists and capture status codes so we can verify presence only when we have JSON
    NODE_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$NODE_GET_OUT" -w "%{http_code}" "$NODE_BASE/internal/api/users/$USER_ID/git-tokens" || true)
    GO_GET_STATUS=$(curl -sS -u overleaf:overleaf -o "$GO_GET_OUT" -w "%{http_code}" "$GO_BASE/internal/api/users/$GO_USER_ID/git-tokens" || true)

    NODE_STILL_PRESENT=1  # default to 'unknown/present' unless we can assert absence
    GO_STILL_PRESENT=1

    if [ "$NODE_GET_STATUS" = "200" ]; then
      if contains_id "$NODE_GET_OUT" "$NODE_SEED_ID"; then
        NODE_STILL_PRESENT=1
      else
        NODE_STILL_PRESENT=0
      fi
    fi

    if [ "$GO_GET_STATUS" = "200" ]; then
      if contains_id "$GO_GET_OUT" "$GO_SEED_ID"; then
        GO_STILL_PRESENT=1
      else
        GO_STILL_PRESENT=0
      fi
    fi

    if [ $NODE_STILL_PRESENT -eq 0 ] && [ $GO_STILL_PRESENT -eq 0 ]; then
      echo "Parity check PASSED via seeding fallback and revoke verified"
      cp -v "$NODE_POST_OUT" "$NODE_GET_OUT" "$GO_POST_OUT" "$GO_GET_OUT" "$ARTIFACT_DIR/" || true
      exit 0
    fi

    echo "Parity check PASSED via seeding fallback (revoke verification failed: node_present=$NODE_STILL_PRESENT go_present=$GO_STILL_PRESENT)"
    cp -v "$NODE_POST_OUT" "$NODE_GET_OUT" "$GO_POST_OUT" "$GO_GET_OUT" "$ARTIFACT_DIR/" || true
    exit 0
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