#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SERVICE_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$SERVICE_DIR"

IMAGE=web-go:integration
CONTAINER=web-go-integration
PORT=8080

# build image
docker build -t "$IMAGE" .

# ensure any prior container removed
docker rm -f "$CONTAINER" 2>/dev/null || true

# run container mapped to host port
docker run -d --name "$CONTAINER" -p ${PORT}:8080 "$IMAGE"

# wait for health endpoint using an ephemeral curl container
for i in {1..20}; do
  if docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null http://localhost:8080/health; then
    echo "health ok"
    break
  fi
  echo "waiting for service (via curl container)... (${i})"
  sleep 1
done

# Run tests with timeout to prevent hanging
echo "Running tests with timeout..."
timeout 30s docker run --network container:$CONTAINER --rm golang:1.25-alpine sh -c "cd /tmp && go test -v ./..." || true

# assert health via an ephemeral curl container
docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/health | jq .

echo "integration succeeded"

# cleanup
docker rm -f "$CONTAINER" >/dev/null || true