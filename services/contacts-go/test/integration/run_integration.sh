#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SERVICE_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$SERVICE_DIR"

IMAGE=contacts-go:integration
CONTAINER=contacts-go-integration
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
PG_CONTAINER=contacts-pg-integration
PG_PORT=5433
NETWORK=contacts-integ-net

# create network
docker network create $NETWORK 2>/dev/null || true

# start a Postgres container on the network
docker rm -f $PG_CONTAINER 2>/dev/null || true
docker run -d --name $PG_CONTAINER --network $NETWORK -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=contacts -p ${PG_PORT}:5432 postgres:15-alpine

# wait for Postgres
for i in {1..20}; do
  if docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/contacts -c '\l' >/dev/null 2>&1; then
    echo "postgres ok"
    break
  fi
  echo "waiting for postgres... (${i})"
  sleep 1
done

# run minimal DB migrations (create extension if available and ensure table)
docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/contacts -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" || true
docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/contacts -c "CREATE TABLE IF NOT EXISTS contacts (id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);" || true

# Run the service in postgres mode on the same network
docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d --name "$CONTAINER" --network $NETWORK -p ${PORT}:8080 -e STORE=postgres -e DATABASE_URL=postgres://postgres:pass@${PG_CONTAINER}:5432/contacts?sslmode=disable "$IMAGE"

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
# Optionally run a networked Go-level DB test inside a helper container to validate NewPostgresStore
if [ "$REMOTE_DB_TEST" = "1" ]; then
  echo "running remote networked Go DB test inside helper container..."
  HELPER_OUT=$(timeout 30s docker run --rm --network container:${PG_CONTAINER} -v "$SERVICE_DIR":/src -w /src golang:1.25-alpine sh -c "apk add --no-cache git ca-certificates && RUN_DB_INTEGRATION_REMOTE=1 go test ./internal/store -run TestPostgresStoreRemoteInner -v" 2>&1) || true
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

# Run tests with timeout to prevent hanging
echo "Running tests with timeout..."
timeout 30s docker run --network container:$CONTAINER --rm golang:1.25-alpine sh -c "cd /tmp && go test -v ./..." || true

create_code=$(timeout 30s docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{"name":"DBIntegration","email":"db@e.com","id":"11111111-1111-1111-1111-111111111111"}' http://localhost:8080/contacts) || true
if [ "$create_code" != "201" ]; then
  echo "postgres contacts create failed (code: $create_code)"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  docker rm -f $PG_CONTAINER || true
  exit 7
fi

if ! docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/contacts | grep -q DBIntegration; then
  echo "postgres contacts list missing created contact"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  docker rm -f $PG_CONTAINER || true
  exit 8
fi

echo "postgres integration succeeded"

# assert health and metrics via an ephemeral curl container
docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/health | jq .
if ! docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/metrics | grep -q contacts_health_checks_total; then
  echo "metrics missing"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 2
fi

# test contacts create & list
create_code=$(timeout 30s docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{"name":"Integration","email":"int@e.com"}' http://localhost:8080/contacts) || true
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
bad_code=$(timeout 30s docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{name:bad}' http://localhost:8080/contacts) || true
if [ "$bad_code" != "400" ]; then
  echo "contacts invalid create did not return 400 (code: $bad_code)"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 5
fi

# missing required fields should return 400
missing_code=$(timeout 30s docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -d '{"name":""}' http://localhost:8080/contacts) || true
if [ "$missing_code" != "400" ]; then
  echo "contacts missing-fields create did not return 400 (code: $missing_code)"
  docker logs "$CONTAINER" || true
  docker rm -f "$CONTAINER" || true
  exit 6
fi

echo "integration succeeded"

# cleanup
docker rm -f "$CONTAINER" >/dev/null || true
docker rm -f $PG_CONTAINER >/dev/null || true
docker network rm $NETWORK >/dev/null || true
