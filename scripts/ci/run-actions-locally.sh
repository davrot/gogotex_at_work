#!/usr/bin/env bash
set -euo pipefail

# Helper to run a specific GitHub Actions job locally using act.
# Usage: scripts/ci/run-actions-locally.sh -j JOB_NAME [-w WORKFLOW_FILE] [-s SECRETS_FILE] [-p RUNNER_IMAGE]

JOB_NAME=""
WORKFLOW_FILE=".github/workflows/integration-web-mongo.yml"
SECRETS_FILE=".secrets"
RUNNER_IMAGE="nektos/act-environments-ubuntu:18.04"

usage() {
  cat <<'USAGE'
Usage: run-actions-locally.sh -j JOB_NAME [-w WORKFLOW_FILE] [-s SECRETS_FILE] [-p RUNNER_IMAGE]

Runs a GitHub Actions job locally using 'act'. The script expects Docker and 'act' to be installed.

Examples:
  scripts/ci/run-actions-locally.sh -j web-mongo-integration
  scripts/ci/run-actions-locally.sh -j web-mongo-integration -s .secrets.local -p "nektos/act-environments-ubuntu:18.04"

Note: Secrets file should contain KEY=VALUE lines. Do NOT commit your secrets file.
USAGE
}

while getopts "j:w:s:p:h" opt; do
  case ${opt} in
    j) JOB_NAME=${OPTARG} ;;
    w) WORKFLOW_FILE=${OPTARG} ;;
    s) SECRETS_FILE=${OPTARG} ;;
    p) RUNNER_IMAGE=${OPTARG} ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

if [ -z "$JOB_NAME" ]; then
  echo "ERROR: -j JOB_NAME is required" >&2
  usage
  exit 2
fi

if ! command -v act >/dev/null 2>&1; then
  echo "ERROR: 'act' not found on PATH. Install it per docs: https://github.com/nektos/act" >&2
  exit 3
fi

if [ -f "$SECRETS_FILE" ]; then
  SECRETS_ARGS=(--secret-file "$SECRETS_FILE")
else
  echo "Warning: secrets file '$SECRETS_FILE' not found. You can still pass secrets via -s or env." >&2
  SECRETS_ARGS=()
fi

# Ensure compose network exists (we expect 'develop' stack) and services up
# This is a best-effort check
if docker network inspect develop_default >/dev/null 2>&1; then
  echo "Using existing compose network: develop_default"
else
  echo "No 'develop_default' network found; ensure docker compose dev network is up (cd develop && bin/up)" >&2
fi

echo "Running act job $JOB_NAME from $WORKFLOW_FILE using runner image $RUNNER_IMAGE"
act -W "$WORKFLOW_FILE" -P ubuntu-latest=$RUNNER_IMAGE -j "$JOB_NAME" "${SECRETS_ARGS[@]}"
