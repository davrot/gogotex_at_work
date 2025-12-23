#!/usr/bin/env bash
set -euo pipefail

# Publish cross-instance dashboard and trend.json to either S3 or GitHub Pages.
# Environment variables:
#  - PUBLISH_DASHBOARD: if set to "true" triggers publishing
#  - AWS_S3_BUCKET: optional S3 bucket name to upload to (requires aws CLI configured)
#  - AWS_S3_PREFIX: optional prefix/path inside the bucket (default: parity-cross)
#  - GITHUB_PAGES_REPO: optional 'owner/repo' to push to gh-pages branch (requires GITHUB_TOKEN)
#  - GITHUB_TOKEN: token used to push to the repo when using GITHUB_PAGES_REPO
# Usage: ./scripts/contract/publish_cross_dashboard.sh

DASH_DIR="ci/flakiness/cross"
DASH_HTML="$DASH_DIR/dashboard.html"
TREND_JSON="$DASH_DIR/trend.json"

if [ "$(${PUBLISH_DASHBOARD:-false})" != "true" ] && [ "$1" != "--force" ]; then
  echo "PUBLISH_DASHBOARD not enabled; skipping publish"
  exit 0
fi

if [ ! -f "$DASH_HTML" ]; then
  echo "No dashboard found at $DASH_HTML; run collector first"
  exit 1
fi

# try S3 first
if [ -n "${AWS_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  PREFIX=${AWS_S3_PREFIX:-parity-cross}
  echo "Uploading $DASH_HTML and $TREND_JSON to s3://${AWS_S3_BUCKET}/${PREFIX}/"
  aws s3 cp "$DASH_HTML" "s3://${AWS_S3_BUCKET}/${PREFIX}/dashboard.html" --acl public-read || true
  if [ -f "$TREND_JSON" ]; then
    aws s3 cp "$TREND_JSON" "s3://${AWS_S3_BUCKET}/${PREFIX}/trend.json" --acl public-read || true
  fi
  echo "S3 upload attempted"
  exit 0
fi

# else try GitHub Pages
if [ -n "${GITHUB_PAGES_REPO:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; then
  tmpdir=$(mktemp -d)
  echo "Cloning $GITHUB_PAGES_REPO into $tmpdir"
  repo_url="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_PAGES_REPO}.git"
  git clone --single-branch --branch gh-pages "$repo_url" "$tmpdir" 2>/dev/null || (
    echo "gh-pages branch not found; creating a new branch in $tmpdir" && git clone "$repo_url" "$tmpdir"
  )
  mkdir -p "$tmpdir/parity-cross"
  # write the current dashboard
  cp "$DASH_HTML" "$tmpdir/parity-cross/dashboard.html"
  if [ -f "$TREND_JSON" ]; then
    cp "$TREND_JSON" "$tmpdir/parity-cross/trend.json"
  fi
  # also create a timestamped archive snapshot for retention
  TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p "$tmpdir/parity-cross/archives/$TIMESTAMP"
  cp "$DASH_HTML" "$tmpdir/parity-cross/archives/$TIMESTAMP/dashboard.html"
  if [ -f "$TREND_JSON" ]; then
    cp "$TREND_JSON" "$tmpdir/parity-cross/archives/$TIMESTAMP/trend.json"
  fi

  pushd "$tmpdir" >/dev/null
  git add parity-cross/dashboard.html parity-cross/trend.json parity-cross/archives/$TIMESTAMP || true
  git commit -m "chore: update parity cross-instance dashboard and archive $TIMESTAMP" || echo "No changes to commit"
  git push origin gh-pages || true
  popd >/dev/null
  rm -rf "$tmpdir"
  echo "Pushed dashboard and archive $TIMESTAMP to gh-pages branch in ${GITHUB_PAGES_REPO}"
  exit 0
fi

echo "No publish target configured (set AWS_S3_BUCKET or GITHUB_PAGES_REPO with creds). Skipping publish."
exit 0
