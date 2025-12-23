#!/usr/bin/env bash
set -euo pipefail
# Helper: build & run the Go webprofile shim locally for development and integration tests
# Usage: ./scripts/dev/run_webprofile_local.sh start|stop|status [--port <port>] [--network develop_default]

CMD=${1:-status}
PORT=3900
NETWORK="develop_default"
CONTAINER_NAME="webprofile-local"
IMAGE_NAME="webprofile-local-image"

# parse optional args
shift || true
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2;;
    --network) NETWORK="$2"; shift 2;;
    *) shift;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Please install Docker to use this script." >&2
  exit 1
fi

if [ "$CMD" = "start" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo "Container $CONTAINER_NAME already running"
    exit 0
  fi

  echo "Building webprofile-api Docker image (local)"
  docker build -f services/git-bridge/cmd/webprofile-api/Dockerfile -t "$IMAGE_NAME" .

  echo "Starting $CONTAINER_NAME on host port $PORT and joining Docker network $NETWORK"
  docker run -d --name "$CONTAINER_NAME" --network "$NETWORK" -p "$PORT":3900 "$IMAGE_NAME"
  echo "Started $CONTAINER_NAME (host port: $PORT)"
  exit 0
fi

if [ "$CMD" = "stop" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"
    echo "Stopped and removed $CONTAINER_NAME"
  else
    echo "$CONTAINER_NAME not running"
  fi
  exit 0
fi

if [ "$CMD" = "status" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    docker ps --filter name="$CONTAINER_NAME" --format '  {{.Names}} {{.Status}} {{.Ports}}'
  else
    echo "$CONTAINER_NAME not running"
  fi
  exit 0
fi

echo "Unknown command: $CMD" >&2
exit 2
