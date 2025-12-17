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

# Wait for web launchpad HTTP to be ready (launchpad listens on 127.0.0.1:13000 in dev)
BASE_URL=${BASE_URL:-http://127.0.0.1:13000}
MAX_WAIT=120
S=0
until curl -sSf "$BASE_URL/launchpad" >/dev/null 2>&1 || [ $S -ge $MAX_WAIT ]; do
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

# Ensure out dir exists and is empty
mkdir -p "$OUT_DIR"
rm -rf "$OUT_DIR"/* || true

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