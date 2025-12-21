#!/usr/bin/env bash
set -euo pipefail

# Fail if any repository file contains the disallowed literal 127.0.0.1:3900
PATTERN='127.0.0.1:3900'
# Exclude node_modules and common binary paths
MATCHES=$(grep -R --line-number --exclude-dir=node_modules --exclude-dir=.git --binary-files=without-match "$PATTERN" . || true)
if [ -n "$MATCHES" ]; then
  echo "Found disallowed occurrences of '$PATTERN':"
  echo "$MATCHES"
  exit 1
fi

echo "No occurrences of $PATTERN found."
exit 0
