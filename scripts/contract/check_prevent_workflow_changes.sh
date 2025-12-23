#!/usr/bin/env bash
set -euo pipefail

# Check staged files (git diff --cached) for changes to .github/workflows/*
# Usage: scripts/contract/check_prevent_workflow_changes.sh [staged_file_list]

STAGED_FILE_LIST="${1:-}"

if [ -n "$STAGED_FILE_LIST" ]; then
  files=$(cat "$STAGED_FILE_LIST")
else
  # get staged files
  files=$(git diff --cached --name-only 2>/dev/null || true)
fi

found=""
for f in $files; do
  case "$f" in
    .github/workflows/*)
      found="$found $f"
      ;;
  esac
done

if [ -n "$found" ] && [ "${ALLOW_WORKFLOW_CHANGES:-}" != "true" ]; then
  echo "Detected changes to GitHub workflow files:$found"
  echo "Workflow changes are disabled in solo mode. To allow, set ALLOW_WORKFLOW_CHANGES=true in your environment."
  echo "Alternatively run: ALLOW_WORKFLOW_CHANGES=true git commit -m \"...\""
  exit 1
fi

exit 0
