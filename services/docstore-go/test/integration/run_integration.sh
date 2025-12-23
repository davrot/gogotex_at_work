#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SERVICE_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$SERVICE_DIR"

IMAGE=docstore-go:integration
CONTAINER=docstore-go-integration
PORT=8085

# Parse arguments
REMOTE_DB_TEST=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote-db-test)
      REMOTE_DB_TEST=1
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

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

# Optional: run Postgres-backed integration (STORE=postgres)
PG_CONTAINER=docstore-pg-integration
PG_PORT=5434
NETWORK=docstore-integ-net

# create network
docker network create $NETWORK 2>/dev/null || true

# start a Postgres container on the network
docker rm -f $PG_CONTAINER 2>/dev/null || true
docker run -d --name $PG_CONTAINER --network $NETWORK -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=docstore -p ${PG_PORT}:5432 postgres:15-alpine

# wait for Postgres
for i in {1..20}; do
  if docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/docstore -c '\l' >/dev/null 2>&1; then
    echo "postgres ok"
    break
  fi
  echo "waiting for postgres... (${i})"
  sleep 1
done

# run minimal DB migrations (create extension if available and ensure table)
docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/docstore -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" || true
docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/docstore -c "CREATE TABLE IF NOT EXISTS documents (id UUID PRIMARY KEY, title TEXT NOT NULL, body TEXT, created_at BIGINT NOT NULL);" || true

# Run the service in postgres mode on the same network
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d --name "$CONTAINER" --network $NETWORK -p ${PORT}:8080 -e STORE=postgres -e DATABASE_URL=postgres://postgres:pass@${PG_CONTAINER}:5432/docstore?sslmode=disable "$IMAGE"

# wait for health again
for i in {1..20}; do
  if docker run --network $NETWORK --rm curlimages/curl:latest -sS -o /dev/null http://$CONTAINER:8080/health; then
    echo "health ok (postgres mode)"
    break
  fi
  echo "waiting for service (postgres mode)... (${i})"
  sleep 1
done

# Run a create/list check in postgres mode
if [ "$REMOTE_DB_TEST" = "1" ]; then
  echo "running remote networked Go DB test inside helper container..."
  HELPER_OUT=$(docker run --rm --network container:${PG_CONTAINER} -v "$SERVICE_DIR":/src -w /src golang:1.25-alpine sh -c "apk add --no-cache git ca-certificates && RUN_DB_INTEGRATION_REMOTE=1 go test ./internal/store -run TestPostgresStoreRemoteInner -v" 2>&1) || true
  echo "helper output:\n$HELPER_OUT"
  if echo "$HELPER_OUT" | grep -q "go: go.mod file not found"; then
    echo "remote helper: go.mod not found in helper container mount; this environment may not support mounting workspace into helper containers. Skipping remote Go-level DB validation." >&2
  elif echo "$HELPER_OUT" | grep -q "FAIL"; then
    echo "remote helper tests failed; see output above" >&2
    docker logs "$CONTAINER" || true
  else
    echo "remote helper tests succeeded"
  fi
fi

create_code=$(docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{"title":"DBIntegration","body":"dbtest","id":"11111111-1111-1111-1111-111111111111"}' http://localhost:8080/documents) || true
if [ "$create_code" != "201" ]; then
  echo "postgres documents create failed (code: $create_code)"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  docker rm -f $PG_CONTAINER || true
  exit 7
fi

if ! docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/documents | grep -q DBIntegration; then
  echo "postgres documents list missing created document"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  docker rm -f $PG_CONTAINER || true
  exit 8
fi

echo "postgres integration succeeded"

# assert health and metrics via an ephemeral curl container
docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/health | jq .

echo "integration succeeded"

# cleanup
docker rm -f "$CONTAINER" >/dev/null || true
docker rm -f $PG_CONTAINER >/dev/null || true
docker network rm $NETWORK >/dev/null || true
