#!/usr/bin/env bash
set -euo pipefail

# CI wrapper to start services and run the focused SSH roundtrip test.
# Expects to be run from repo root.
ROOT_DIR=$(pwd)
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIR/develop/docker-compose.yml"}
PROJECT_DIR=${PROJECT_DIR:-"$ROOT_DIR/develop"}
OUT_DIR=${OUT_DIR:-"$ROOT_DIR/services/web/test/e2e/playwright/out"}

echo "Using COMPOSE_FILE=$COMPOSE_FILE PROJECT_DIR=$PROJECT_DIR"

# Bring up minimal services: web and git-bridge
docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" up -d --build web git-bridge

# Wait for web launchpad HTTP to be ready. Prefer provided BASE_URL; fall back to the compose service host if necessary
BASE_URL=${BASE_URL:-http://web:3000}
MAX_WAIT=120
S=0
# try provided BASE_URL first
until curl -sSf "$BASE_URL/launchpad" >/dev/null 2>&1 || curl -sSf "http://web:3000/launchpad" >/dev/null 2>&1 || [ $S -ge $MAX_WAIT ]; do
  printf "."
  sleep 1
  S=$((S+1))
done
if [ $S -ge $MAX_WAIT ]; then
  echo "web launchpad not ready after ${MAX_WAIT}s" >&2
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs web || true
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs git-bridge || true
  exit 2
fi

# Wait for main JS asset to be available (frontend build/dev server readiness)
MAX_ASSET_WAIT=${MAX_ASSET_WAIT:-60}
A=0
until curl -sSf "$BASE_URL/js/runtime.js" >/dev/null 2>&1 || [ $A -ge $MAX_ASSET_WAIT ]; do
  printf "."
  sleep 1
  A=$((A+1))
done
if [ $A -ge $MAX_ASSET_WAIT ]; then
  echo "runtime.js not available after ${MAX_ASSET_WAIT}s" >&2
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs web || true
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs git-bridge || true
  exit 2
fi

# Ensure out dir exists and is empty
mkdir -p "$OUT_DIR"
rm -rf "$OUT_DIR"/* || true

# Ensure host key entry for git bridge doesn't block SSH operations (remove stale entry if present)
ssh-keygen -f "$HOME/.ssh/known_hosts" -R '[develop-git-bridge-1]:2222' >/dev/null 2>&1 || true

# Run the focused Playwright SSH roundtrip test in non-interactive mode
CONFIRM_DEV_SETUP=true CONFIRM_BASE_URL=true BASE_URL=$BASE_URL COMPOSE_FILE="$COMPOSE_FILE" PROJECT_DIR="$PROJECT_DIR" node services/web/test/e2e/playwright/git_roundtrip_ssh.mjs || {
  echo "Smoke test failed; collecting logs"
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs web > "$OUT_DIR/web.logs" || true
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs git-bridge > "$OUT_DIR/git-bridge.logs" || true
  ls -la "$OUT_DIR" || true
  exit 3
}

# Teardown services
docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" down --remove-orphans

echo "Smoke test completed successfully; artifacts (if any) are in $OUT_DIR"