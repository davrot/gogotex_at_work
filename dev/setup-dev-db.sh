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
    # If a stopped container with the same name exists, remove it to allow a fresh start
    if docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
      echo "Found existing container $CONTAINER_NAME (not running); removing..."
      docker rm "$CONTAINER_NAME" >/dev/null || true
    fi

    # Allow the caller to override the host port via env var MONGO_HOST_PORT or via an optional second argument
    HOST_PORT="${MONGO_HOST_PORT:-${2:-27017}}"

    # Helper to check if the host port is already in use (checks sockets and existing docker port mappings)
    is_port_in_use() {
      # check sockets first
      if ss -ltnp 2>/dev/null | grep -q ":$1\b"; then
        return 0
      fi
      # check if any existing container maps the port to host
      if docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":$1->"; then
        return 0
      fi
      return 1
    }

    if is_port_in_use "$HOST_PORT"; then
      echo "Requested host port $HOST_PORT is in use; searching for a free port in range 27017-27117..."
      FOUND=0
      for p in $(seq 27017 27117); do
        if ! is_port_in_use "$p"; then
          HOST_PORT=$p
          FOUND=1
          break
        fi
      done
      if [ "$FOUND" -eq 0 ]; then
        echo "No free port found in 27017-27117; please free a port or set MONGO_HOST_PORT to an unused port" >&2
        exit 1
      fi
      echo "Using available host port $HOST_PORT"
    fi

    echo "Starting MongoDB container $CONTAINER_NAME on host port $HOST_PORT -> container 27017"
    docker run -d --name "$CONTAINER_NAME" -p "$HOST_PORT":27017 mongo:6 --bind_ip_all >/dev/null
    echo "Started $CONTAINER_NAME (host port: $HOST_PORT)"
    echo "Tip: to connect from the host use MONGO_URI='mongodb://localhost:$HOST_PORT'"
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
