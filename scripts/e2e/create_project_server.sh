#!/usr/bin/env bash
set -euo pipefail

USER_ID=${1:-}
NAME=${2:-playwright-project-$(date +%s)}
COMPOSE_FILE=${COMPOSE_FILE:-/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop/docker-compose.yml}
PROJECT_DIR=${PROJECT_DIR:-/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/develop}
OUT_FILE=${OUT_FILE:-/workspaces/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension/services/web/test/e2e/playwright/out/created_project_id.txt}

if [ -z "$USER_ID" ]; then
  echo "Usage: $0 <user-id> [name]"
  exit 2
fi

# Run project creation inside the web container (uses server-side Node environment)
CMD=(docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" exec -T web node /overleaf/services/web/scripts/create_project.mjs --user-id="$USER_ID" --name="$NAME")

echo "Running: ${CMD[*]}"
OUTPUT=$("${CMD[@]}" 2>&1 || true)
# The script prints 'Created project <id>' on success; parse the ID
PROJECT_ID=$(echo "$OUTPUT" | sed -n "s/.*'\([0-9a-f]\{24\}\)'.*/\1/p" | tail -n1)
# Fallback: try to match 'Created project <id>' too
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(echo "$OUTPUT" | sed -n 's/Created project \([[:alnum:]]\+\)/\1/p' | tail -n1)
fi
if [ -n "$PROJECT_ID" ]; then
  echo "$PROJECT_ID" > "$OUT_FILE"
  echo "$PROJECT_ID"
  exit 0
else
  echo "Failed to create project. Output:" >&2
  echo "$OUTPUT" >&2
  exit 3
fi
