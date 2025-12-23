#!/usr/bin/env bash
set -euo pipefail

# Test runner for check_prevent_workflow_changes.sh
TMP=$(mktemp)
echo ".github/workflows/new-workflow.yml" > "$TMP"

# Expect failure when ALLOW_WORKFLOW_CHANGES not set
if scripts/contract/check_prevent_workflow_changes.sh "$TMP"; then
  echo "FAILED: checker should have failed when workflow changes present and ALLOW_WORKFLOW_CHANGES not set"
  rm "$TMP"
  exit 1
else
  echo "OK: checker rejected workflow change as expected"
fi

# Now allow changes
ALLOW_WORKFLOW_CHANGES=true scripts/contract/check_prevent_workflow_changes.sh "$TMP"
echo "OK: checker allowed changes when ALLOW_WORKFLOW_CHANGES=true"

rm "$TMP"
echo "ALL OK"
