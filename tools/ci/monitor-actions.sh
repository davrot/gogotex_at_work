#!/usr/bin/env bash
set -euo pipefail

# Simple Actions monitor + auto-fix script
# Behavior:
# - List the most recent failed runs
# - For each run, attempt up to MAX_RERUNS reruns
# - If still failing, file an issue with run details
# - Uses gh CLI authentication (ensure `gh auth status` passes)

MAX_RERUNS=${MAX_RERUNS:-2}
LIMIT=${LIMIT:-50}

echo "Checking GH authentication..."
if ! gh auth status >/dev/null 2>&1; then
  echo "gh not authenticated; run 'gh auth login' first" >&2
  exit 1
fi

runs_json=$(gh run list --status failure --limit "$LIMIT" --json databaseId,name,workflowName,headBranch,url)

if [ "$(echo "$runs_json" | jq 'length')" -eq 0 ]; then
  echo "No recent failed runs found."
  exit 0
fi

for row in $(echo "$runs_json" | jq -c '.[]'); do
  id=$(echo "$row" | jq -r '.databaseId')
  name=$(echo "$row" | jq -r '.workflowName')
  branch=$(echo "$row" | jq -r '.headBranch')
  url=$(echo "$row" | jq -r '.htmlUrl')

  echo "Found failed run: id=$id workflow=$name branch=$branch url=$url"

  rerun_count=0
  succeeded=false

  while [ $rerun_count -lt $MAX_RERUNS ]; do
    rerun_count=$((rerun_count + 1))
    echo "Attempting rerun #$rerun_count for run $id"
    if gh run rerun "$id"; then
      echo "Rerun triggered; waiting for completion..."
      # Poll for completion
      for i in $(seq 1 60); do
        sleep 10
        status=$(gh run view "$id" --json status,conclusion --jq '.status+" " + (.conclusion // "null")')
        echo "Status: $status"
        if echo "$status" | grep -q "completed"; then
          concl=$(echo "$status" | awk '{print $2}')
          if [ "$concl" = "success" ]; then
            echo "Run $id succeeded on rerun #$rerun_count"
            succeeded=true
            break
          else
            echo "Run $id completed with conclusion: $concl"
            break
          fi
        fi
      done
      if [ "$succeeded" = true ]; then
        break
      fi
    else
      echo "Failed to trigger rerun for run $id (maybe ephemeral or not rerunnable)";
      break
    fi
  done

  if [ "$succeeded" = false ]; then
    echo "Run $id failed after $rerun_count reruns; opening an issue"
    title="[AUTO] Workflow failure: $name (branch: $branch)"
    body="Automated monitor detected repeated failures for workflow **$name** on branch **$branch**.\n\nRun: $url\n\nReruns attempted: $rerun_count\n\nPlease investigate. Logs attached or viewable at the run URL."
    # Try to create an issue; if label is missing, create without label
    if ! gh issue create --title "$title" --body "$body" --label "ci/failure" 2>/dev/null; then
      echo "Label 'ci/failure' missing or issue create failed with label; trying without label"
      if ! gh issue list --search "$title" --json number --jq '. | length' | grep -q "^0$"; then
        echo "Issue already exists for this failure: $title"
      else
        gh issue create --title "$title" --body "$body" || echo "Could not create issue (maybe one already exists)"
      fi
    fi
  fi
done

echo "Monitor run complete." 
