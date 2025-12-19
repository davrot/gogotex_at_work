#!/usr/bin/env bash
set -euo pipefail

# CI wrapper to start services and run the focused SSH roundtrip test.
# Expects to be run from repo root.
ROOT_DIR=$(pwd)
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIR/develop/docker-compose.yml"}
PROJECT_DIR=${PROJECT_DIR:-"$ROOT_DIR/develop"}
OUT_DIR=${OUT_DIR:-"$ROOT_DIR/services/web/test/e2e/playwright/out"}

echo "Using COMPOSE_FILE=$COMPOSE_FILE PROJECT_DIR=$PROJECT_DIR"

# Bring up minimal services: webpack, web and git-bridge (webpack serves frontend assets in dev)
# (Allow skipping compose for timeout verification by setting SKIP_COMPOSE=1)
if [ "${SKIP_COMPOSE:-0}" != "1" ]; then
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" up -d --build webpack web git-bridge
else
  echo "SKIP_COMPOSE=1: skipping docker compose up (for timeout verification)"
fi

# Wait for web launchpad HTTP to be ready. Prefer provided BASE_URL; fall back to webpack dev server then to the compose service host if necessary
BASE_URL=${BASE_URL:-http://develop-webpack-1:3808}
MAX_WAIT=120
S=0
# try provided BASE_URL first (can be skipped for verification by setting SKIP_WAIT=1)
if [ "${SKIP_WAIT:-0}" != "1" ]; then
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
else
  echo "SKIP_WAIT=1: skipping web launchpad readiness checks"
fi

# Wait for main JS asset or manifest to be available (frontend build/dev server readiness)
MAX_ASSET_WAIT=${MAX_ASSET_WAIT:-180}
A=0
# Can skip asset wait during verification using SKIP_WAIT=1
if [ "${SKIP_WAIT:-0}" != "1" ]; then
  until curl -sSf "$BASE_URL/manifest.json" >/dev/null 2>&1 || curl -sSf "$BASE_URL/js/runtime.js" >/dev/null 2>&1 || [ $A -ge $MAX_ASSET_WAIT ]; do
    printf "."
    sleep 1
    A=$((A+1))
  done
  if [ $A -ge $MAX_ASSET_WAIT ]; then
    echo "frontend assets not available after ${MAX_ASSET_WAIT}s" >&2
    docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs webpack || true
    docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs web || true
    docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs git-bridge || true
    exit 2
  fi
else
  echo "SKIP_WAIT=1: skipping asset readiness checks"
fi

# Ensure out dir exists and is empty
mkdir -p "$OUT_DIR"
rm -rf "$OUT_DIR"/* || true

SMOKE_TIMEOUT=${SMOKE_TIMEOUT:-600}

# Ensure host key entry for git bridge doesn't block SSH operations (remove stale entry if present)
ssh-keygen -f "$HOME/.ssh/known_hosts" -R '[develop-git-bridge-1]:2222' >/dev/null 2>&1 || true

# Run the focused Playwright SSH roundtrip test in non-interactive mode with a timeout
# ---- CONTROLLED HANG (temporary for timeout verification) ----
# Replace the Playwright invocation with a sleep to simulate a hang.
# WARNING: This change is temporary and should be reverted after verification.
# You can remove this block after running the verification.
run_cmd_with_timeout() {
  local cmd="$1"
  local to="$2"
  local child watcher rc marker timed_out

  # Start the command in its own session so we can target the whole process group
  setsid bash -lc "$cmd" >/dev/null 2>&1 &
  child=$!

  # marker file to detect watcher firing (handles shells that exit 0 on TERM)
  marker=$(mktemp -u /tmp/run_timeout_marker.XXXXXX)
  timed_out=0

  # watcher: touch marker, send TERM to the process group after timeout, then KILL after 5s
  ( sleep "$to"; echo "DEBUG: timeout watcher firing for pid $child" >&2; touch "$marker" 2>/dev/null || true; kill -TERM "-"$child 2>/dev/null || true; sleep 5; kill -KILL "-"$child 2>/dev/null || true ) &
  watcher=$!

  # wait for child to exit and capture its exit status
  wait "$child" 2>/dev/null || true
  rc=$?

  # detect whether watcher fired (timeout) even if child exit code is 0
  if [ -f "$marker" ]; then
    timed_out=1
    rm -f "$marker" 2>/dev/null || true
  fi

  # cancel watcher if still running
  kill -0 "$watcher" 2>/dev/null && kill "$watcher" 2>/dev/null || true
  echo "DEBUG: run_cmd_with_timeout exit code: $rc timed_out=$timed_out" >&2

  # if timed_out, return a distinctive exit status >128 to indicate timeout
  if [ "$timed_out" -eq 1 ]; then
    return 137
  fi

  return $rc
}

# Two modes for verification:
# - Normal: run the Playwright node test with timeout
# - Verify hang: set VERIFY_HANG=1 in env to simulate a hanging command (sleep)
if [ "${VERIFY_HANG:-0}" = "1" ]; then
  if run_cmd_with_timeout "sleep 10" "$SMOKE_TIMEOUT"; then rc=0; else rc=$?; fi
else
  if run_cmd_with_timeout "CONFIRM_DEV_SETUP=true CONFIRM_BASE_URL=true BASE_URL='$BASE_URL' COMPOSE_FILE='$COMPOSE_FILE' PROJECT_DIR='$PROJECT_DIR' node services/web/test/e2e/playwright/git_roundtrip_ssh.mjs" "$SMOKE_TIMEOUT"; then rc=0; else rc=$?; fi
fi

echo "DEBUG: timeout exit code captured: $rc" >&2
if [ "$rc" -ne 0 ]; then
  # If the command was terminated by a signal it will have an exit code > 128
  if [ $rc -gt 128 ]; then
    echo "Smoke test timed out after ${SMOKE_TIMEOUT}s (exit $rc)" >&2
  else
    echo "Smoke test failed with exit code $rc" >&2
  fi
  echo "Collecting logs"

  # Prefer container-level `docker logs` to avoid potentially blocking compose logs; fall back to compose logs if container not found
  git_bridge_id=$(docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" ps -q git-bridge || true)
  web_id=$(docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" ps -q web || true)

  if [ -n "$web_id" ]; then
    timeout 15s docker logs --since 60s --timestamps --tail 200 "$web_id" > "$OUT_DIR/web.logs" || true
  else
    timeout 15s docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs web > "$OUT_DIR/web.logs" || true
  fi

  if [ -n "$git_bridge_id" ]; then
    timeout 15s docker logs --since 60s --timestamps --tail 200 "$git_bridge_id" > "$OUT_DIR/git-bridge.logs" || true
  else
    timeout 15s docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" logs git-bridge > "$OUT_DIR/git-bridge.logs" || true
  fi

  ls -la "$OUT_DIR" || true
  exit 3
fi

# Teardown services
docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" down --remove-orphans

echo "Smoke test completed successfully; artifacts (if any) are in $OUT_DIR"