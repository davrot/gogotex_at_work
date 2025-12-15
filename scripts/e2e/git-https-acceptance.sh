#!/usr/bin/env bash
set -euo pipefail

# Simple acceptance test for git-over-HTTPS against git-bridge (dev)
# Usage: ./scripts/e2e/git-https-acceptance.sh <projectId> <git_bridge_host> <http_port> <token>

PROJECT_ID=${1:-}
GIT_HOST=${2:-localhost}
HTTP_PORT=${3:-33887}
TOKEN=${4:-}

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
GIT_URL="https://git:${TOKEN}@${GIT_HOST}:${HTTP_PORT}/${PROJECT_ID}.git"

echo "Testing git ls-remote against $GIT_URL"
set +e
GIT_OUTPUT=$(git ls-remote "$GIT_URL" 2>&1)
GIT_EXIT=$?
set -e

echo "$GIT_OUTPUT" | sed -n '1,20p'

if [ $GIT_EXIT -ne 0 ]; then
  echo "git ls-remote failed (exit $GIT_EXIT) — continuing to check logs" 
fi

# Check git-bridge logs for structured auth events
echo "Checking git-bridge logs for auth.http_attempt events..."
LOGS=$(docker logs develop-git-bridge-1 --since 2m || true)
if echo "$LOGS" | grep -q "auth.http_attempt"; then
  echo "Recent auth.http_attempt entries:"
  echo "$LOGS" | grep "auth.http_attempt" | tail -n 20
else
  echo "No auth.http_attempt events found in git-bridge logs."
fi

# Assert we have an auth success for the project
if echo "$LOGS" | grep -q "\"project\": \"$PROJECT_ID\"" ; then
  if echo "$LOGS" | grep -q "\"project\": \"$PROJECT_ID\".*\"outcome\":\"success\"" ; then
    echo "Found auth success for project $PROJECT_ID"
  else
    echo "Project $PROJECT_ID seen in logs, but no success outcome recorded"
    exit 3
  fi
else
  echo "Project $PROJECT_ID not found in recent auth.http_attempt logs"
  exit 3
fi

# Optionally assert there was an HTTP auth attempt at all
if ! echo "$LOGS" | grep -q "auth.http_attempt" ; then
  echo "No auth.http_attempt events found"
  exit 4
fi

echo "HTTPS git acceptance check completed."
exit 0
