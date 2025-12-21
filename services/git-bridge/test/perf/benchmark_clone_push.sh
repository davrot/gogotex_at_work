#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=$(mktemp -d)
REPORT=${OUT_DIR}/report.json

# Create a small bare repo and a work repo
WORKDIR=$(mktemp -d)
cd "$WORKDIR"
mkdir repo.git
cd repo.git
git init --bare

# Clone as a local clone to measure clone time
CLONE_DIR=$(mktemp -d)
START_CLONE=$(date +%s%3N)
git clone "$WORKDIR/repo.git" "$CLONE_DIR" --depth 1 >/dev/null 2>&1 || true
END_CLONE=$(date +%s%3N)
CLONE_MS=$((END_CLONE - START_CLONE))

# Make an empty commit and push
cd "$CLONE_DIR"
git config user.email "perf@example.com"
git config user.name "Perf"
START_PUSH=$(date +%s%3N)
git commit --allow-empty -m "perf commit" >/dev/null 2>&1 || true
git push origin HEAD:refs/heads/main >/dev/null 2>&1 || true
END_PUSH=$(date +%s%3N)
PUSH_MS=$((END_PUSH - START_PUSH))

jq -n --arg clone_ms "$CLONE_MS" --arg push_ms "$PUSH_MS" '{clone_ms: ($clone_ms|tonumber), push_ms: ($push_ms|tonumber), repo_size_bytes: 0, runs: 1}' > "$REPORT"

echo "Generated perf report: $REPORT"
cat "$REPORT"

# Exit with success code; the CI workflow can evaluate thresholds
exit 0
