#!/bin/bash

# This script is meant to be run as root when the git bridge starts up in
# Server Pro. It ensures that the data directory is created and owned by the
# "node" user, which is the regular user git bridge runs as.

ROOT_DIR="${GIT_BRIDGE_ROOT_DIR:-/tmp/wlgb}"
mkdir -p "$ROOT_DIR"
chown node:node "$ROOT_DIR"

# If running as root, drop privileges using setpriv (preferred) else just exec /start.sh
if [ "$(id -u)" -eq 0 ]; then
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=node --regid=node --init-groups /start.sh
  elif command -v su-exec >/dev/null 2>&1; then
    exec su-exec node /start.sh
  else
    # Fallback: run start.sh as-is (the process may continue as root)
    exec /start.sh
  fi
else
  exec /start.sh
fi
