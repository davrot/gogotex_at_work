#!/usr/bin/env bash
set -euo pipefail

# Quick helper to start a local Mongo for integration tests using docker
# Usage: ./dev/setup-dev-db.sh start|stop|status

CMD=${1:-status}
CONTAINER_NAME="overleaf-dev-mongo"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Please install Docker to use this script." >&2
  exit 1
fi

if [ "$CMD" = "start" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo "Container $CONTAINER_NAME already running"
  else
    echo "Starting MongoDB container $CONTAINER_NAME on port 27017"
    docker run -d --name "$CONTAINER_NAME" -p 27017:27017 mongo:6 --bind_ip_all >/dev/null
    echo "Started $CONTAINER_NAME"
  fi
  exit 0
fi

if [ "$CMD" = "stop" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"
    echo "Stopped and removed $CONTAINER_NAME"
  else
    echo "Container $CONTAINER_NAME not running"
  fi
  exit 0
fi

if [ "$CMD" = "status" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo "Container $CONTAINER_NAME is running"
    docker ps --filter name="$CONTAINER_NAME" --format '  {{.Names}} {{.Status}} {{.Ports}}'
  else
    echo "Container $CONTAINER_NAME is not running"
  fi
  exit 0
fi

echo "Unknown command: $CMD" >&2
exit 2
