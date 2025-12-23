#!/usr/bin/env bash
set -euo pipefail

echo "Preflight check: verifying required local tools"
missing=()

check_cmd(){
  if ! command -v "$1" >/dev/null 2>&1; then
    missing+=("$1")
  fi
}

check_cmd docker
check_cmd node
check_cmd npm
check_cmd go
check_cmd jq
check_cmd timeout || true # timeout may be shell built-in or 'timeout' binary
check_cmd patch-package || true

if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required tools: ${missing[*]}"
  echo "Please install the missing tools. Example:"
  echo "  apt install docker.io nodejs npm golang jq coreutils"
  exit 2
fi

# Check docker daemon running
if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but daemon is not running or you lack permissions."
    echo "Try: sudo systemctl start docker or add your user to the docker group."
  fi
fi

# Check GO_RUN_TIMEOUT is defined
if [ -z "${GO_RUN_TIMEOUT:-}" ]; then
  echo "GO_RUN_TIMEOUT not set, using default 30s"
  export GO_RUN_TIMEOUT='30s'
fi

echo "All required tools present (or optionally available)."
exit 0
