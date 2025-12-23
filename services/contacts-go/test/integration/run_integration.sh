#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SERVICE_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$SERVICE_DIR"

IMAGE=contacts-go:integration
CONTAINER=contacts-go-integration
PORT=8085

# build image
docker build -t "$IMAGE" .

# ensure any prior container removed
docker rm -f "$CONTAINER" 2>/dev/null || true

# run container mapped to host port
docker run -d --name "$CONTAINER" -p ${PORT}:8080 "$IMAGE"

# wait for health endpoint using an ephemeral curl container in the same network namespace
for i in {1..20}; do
  if docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null http://localhost:8080/health; then
    echo "health ok"
    break
  fi
  echo "waiting for service (via curl container)... (${i})"
  sleep 1
done

# assert health and metrics via an ephemeral curl container
docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/health | jq .
if ! docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/metrics | grep -q contacts_health_checks_total; then
  echo "metrics missing"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 2
fi

# test contacts create & list
create_code=$(docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{"name":"Integration","email":"int@e.com"}' http://localhost:8080/contacts) || true
if [ "$create_code" != "201" ]; then
  echo "contacts create failed (code: $create_code)"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 3
fi

if ! docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/contacts | grep -q Integration; then
  echo "contacts list missing created contact"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 4
fi

# invalid JSON should return 400
bad_code=$(docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{name:bad}' http://localhost:8080/contacts) || true
if [ "$bad_code" != "400" ]; then
  echo "contacts invalid create did not return 400 (code: $bad_code)"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 5
fi

echo "integration succeeded"

docker rm -f "$CONTAINER" >/dev/null
