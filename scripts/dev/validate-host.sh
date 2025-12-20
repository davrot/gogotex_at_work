#!/usr/bin/env bash
set -euo pipefail

# validate-host.sh <varname> <host> <context>
# Fails if host is localhost or 127.0.0.1

VAR_NAME=${1:-}
HOST=${2:-}
CONTEXT=${3:-host}

if [ -z "$HOST" ]; then
  echo "ERROR: Host for $VAR_NAME is empty (context: $CONTEXT)"
  exit 2
fi

if echo "$HOST" | grep -E "(^127\.0\.0\.1$|^localhost$)" >/dev/null 2>&1; then
  echo "ERROR: $VAR_NAME ($CONTEXT) must not be localhost or 127.0.0.1 in dev/test runs."
  echo "Please use the compose hostname (e.g., 'mongo' or 'develop-git-bridge') or set the host to a resolvable dev network address."
  echo "See docs/dev-setup.md for guidance."
  exit 2
fi

exit 0
