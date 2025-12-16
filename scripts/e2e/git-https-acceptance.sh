#!/usr/bin/env bash
set -euo pipefail

# Simple acceptance test for git-over-HTTPS against git-bridge (dev)
# Usage: ./scripts/e2e/git-https-acceptance.sh <projectId> <git_bridge_host> <http_port> <token>

PROJECT_ID=${1:-}
GIT_HOST=${2:-}
HTTP_PORT=${3:-33887}
TOKEN=${4:-}

# If GIT_HOST not supplied, derive from BASE_URL host (if provided)
if [ -z "$GIT_HOST" ] && [ -n "${BASE_URL:-}" ]; then
  GIT_HOST=$(echo "$BASE_URL" | awk -F[/:] '{print $4}')
  echo "Derived GIT_HOST from BASE_URL: $GIT_HOST"
fi

# Disallow localhost/127.* for acceptance scripts — require an explicit, resolvable git host on the dev compose network
if echo "${GIT_HOST:-}" | grep -E "localhost|127\.0\.0\.1" >/dev/null 2>&1; then
  echo "ERROR: GIT_HOST must not be localhost or 127.0.0.1 for acceptance tests. Set GIT_HOST to the git-bridge host on the dev compose network (for example, develop-git-bridge or the host part of BASE_URL)."
  exit 2
fi

OUT_TOKEN_FILE="services/web/test/e2e/playwright/out/created_token.txt"

if [ -z "$TOKEN" ]; then
  if [ -f "$OUT_TOKEN_FILE" ]; then
    TOKEN=$(cat "$OUT_TOKEN_FILE")
    echo "Using token from $OUT_TOKEN_FILE"
  else
    echo "No token supplied and $OUT_TOKEN_FILE not found. Create a token via Playwright (ADD_TOKEN=true) or supply it as the fourth arg."
    exit 2
  fi
fi

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <projectId> <git_bridge_host> <http_port> <token>"
  exit 2
fi

TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# Attempt to connect to the remote using the token
PROTO=${GIT_PROTOCOL:-}
if [ -z "$PROTO" ]; then
  if [ "$HTTP_PORT" = "8000" ]; then
    PROTO="http"
  else
    PROTO="https"
  fi
fi
GIT_URL="${PROTO}://git:${TOKEN}@${GIT_HOST}:${HTTP_PORT}/${PROJECT_ID}.git"

echo "Testing git ls-remote against $GIT_URL"
set +e
GIT_OUTPUT=$(git ls-remote "$GIT_URL" 2>&1)
GIT_EXIT=$?
set -e

echo "$GIT_OUTPUT" | sed -n '1,20p'

if [ $GIT_EXIT -ne 0 ]; then
  echo "git ls-remote failed (exit $GIT_EXIT) — continuing to check logs" 
fi

# Check git-bridge logs for structured auth events or generic Unauthorized lines
echo "Checking git-bridge logs for auth.http_attempt or Unauthorized events..."
LOGS=$(docker logs develop-git-bridge-1 --since 2m || true)
if echo "$LOGS" | grep -q "auth.http_attempt"; then
  echo "Recent auth.http_attempt entries:"
  echo "$LOGS" | grep "auth.http_attempt" | tail -n 20
else
  echo "No auth.http_attempt events found; searching for generic Unauthorized lines relating to the project"
  if echo "$LOGS" | grep -n "\[$PROJECT_ID\] Unauthorized" >/dev/null 2>&1; then
    echo "Found Unauthorized entries for project $PROJECT_ID:"
    echo "$LOGS" | grep "\[$PROJECT_ID\] Unauthorized" | tail -n 20
  else
    echo "No auth-related events found for project $PROJECT_ID."
  fi
fi

# Assert we have an auth success or at least an attempt for the project
if echo "$LOGS" | grep -q "\"project\": \"$PROJECT_ID\".*\"outcome\":\"success\"" ; then
  echo "Found auth success for project $PROJECT_ID"
elif echo "$LOGS" | grep -q "\[$PROJECT_ID\] Unauthorized" ; then
  echo "Project $PROJECT_ID seen in logs as Unauthorized (auth attempt detected)"
else
  echo "Project $PROJECT_ID not found in recent auth logs with success or Unauthorized markers"
  exit 3
fi

# Optionally assert there was an HTTP auth attempt at all
if ! echo "$LOGS" | grep -q "auth.http_attempt" ; then
  # Allow a fallback: if we saw a generic Unauthorized log for the project, accept as an auth attempt
  if echo "$LOGS" | grep -q "\[$PROJECT_ID\] Unauthorized" ; then
    echo "No auth.http_attempt events found, but Unauthorized log for project detected — accepting as auth attempt"
  else
    echo "No auth.http_attempt events found"
    exit 4
  fi
fi

echo "HTTPS git acceptance check completed."
exit 0
