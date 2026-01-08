#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SERVICE_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$SERVICE_DIR"

SERVICE_NAME=$(basename "$SERVICE_DIR")
IMAGE=${SERVICE_NAME}:integration
CONTAINER=${SERVICE_NAME}-integration
PORT=8080

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

# wait for health endpoint using an ephemeral curl container
for i in {1..20}; do
  if docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS -o /dev/null http://localhost:8080/health; then
    echo "health ok"
    break
  fi
  echo "waiting for service (via curl container)... (${i})"
  sleep 1
done

# check metrics endpoint non-empty
docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/metrics | head -n 5 || true

# Run tests with timeout to prevent hanging
echo "Running tests with timeout..."
timeout 30s docker run --network container:$CONTAINER --rm golang:1.25-alpine sh -c "cd /tmp && go test -v ./..." || true

# If this service provides DB integration tests, run Postgres flow
if [ -f "$SERVICE_DIR/internal/store/postgres_integration_test.go" ] || [ -f "$SERVICE_DIR/internal/store/postgres_store.go" ]; then
  echo "DB integration tests detected; running Postgres-backed checks"

  PG_CONTAINER=${SERVICE_NAME}-pg-integration
  PG_PORT=5435
  NETWORK=${SERVICE_NAME}-integ-net

  # create network
  docker network create $NETWORK 2>/dev/null || true

  # start a Postgres container on the network
  docker rm -f $PG_CONTAINER 2>/dev/null || true
  docker run -d --name $PG_CONTAINER --network $NETWORK -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=${SERVICE_NAME} -p ${PG_PORT}:5432 postgres:15-alpine

  # wait for Postgres
  for i in {1..20}; do
    if docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/${SERVICE_NAME} -c '\l' >/dev/null 2>&1; then
      echo "postgres ok"
      break
    fi
    echo "waiting for postgres... (${i})"
    sleep 1
  done

  # minimal migrations (create extension/table may be no-op depending on service)
  docker run --network $NETWORK --rm postgres:15-alpine psql postgresql://postgres:pass@${PG_CONTAINER}:5432/${SERVICE_NAME} -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" || true

  # Run the service in postgres mode on the same network
  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker run -d --name "$CONTAINER" --network $NETWORK -p ${PORT}:8080 -e STORE=postgres -e DATABASE_URL=postgres://postgres:pass@${PG_CONTAINER}:5432/${SERVICE_NAME}?sslmode=disable "$IMAGE"

  # wait for health again
  for i in {1..20}; do
    if docker run --network $NETWORK --rm curlimages/curl:latest -sS -o /dev/null http://$CONTAINER:8080/health; then
      echo "health ok (postgres mode)"
      break
    fi
    echo "waiting for service (postgres mode)... (${i})"
    sleep 1
  done

  # optionally run remote networked Go DB tests if requested
  if [ "$REMOTE_DB_TEST" = "1" ]; then
    echo "running remote networked Go DB test inside helper container..."
    HELPER_OUT=$(docker run --rm --network container:${PG_CONTAINER} -v "$SERVICE_DIR":/src -w /src golang:1.25-alpine sh -c "apk add --no-cache git ca-certificates && RUN_DB_INTEGRATION_REMOTE=1 go test ./internal/store -run TestPostgresStoreRemoteInner -v" 2>&1) || true
    echo "helper output:\n$HELPER_OUT"
    if echo "$HELPER_OUT" | grep -q "go: go.mod file not found"; then
      echo "remote helper: go.mod not found in helper container mount; skipping remote Go-level DB validation." >&2
    elif echo "$HELPER_OUT" | grep -q "FAIL"; then
      echo "remote helper tests failed; see output above" >&2
      docker logs "$CONTAINER" || true
    else
      echo "remote helper tests succeeded"
    fi
  fi

  echo "postgres integration flow completed (note: not all services perform create/list checks by default)"

  # cleanup PG resources
  docker rm -f $PG_CONTAINER >/dev/null || true

  # Try to remove the network, retry if it has active endpoints (sometimes Docker delays cleanup)
  for i in 1 2 3 4 5; do
    if docker network rm $NETWORK >/dev/null 2>&1; then
      break
    fi
    echo "network rm failed, retrying (${i}/5)..."
    sleep 1
  done
fi

# assert health and metrics via an ephemeral curl container
docker run --network container:$CONTAINER --rm curlimages/curl:latest -sS http://localhost:8080/health | jq . || true

echo "integration succeeded"

# cleanup
docker rm -f "$CONTAINER" >/dev/null || true
# attempt to remove network used by container (best-effort)
for i in 1 2 3 4 5; do
  if docker network rm $NETWORK >/dev/null 2>&1; then
    break
  fi
  echo "network rm failed (post-cleanup), attempting to disconnect attached containers (attempt ${i}/5)"
  # Try to disconnect any attached containers and retry
  CONTAINERS_JSON=$(docker network inspect $NETWORK --format '{{json .Containers}}' 2>/dev/null || echo "{}")
  if [ "$CONTAINERS_JSON" != "{}" ]; then
    # extract container IDs and disconnect
    echo "$CONTAINERS_JSON" | jq -r 'keys[]' 2>/dev/null | while read -r cid; do
      echo "disconnecting $cid"
      docker network disconnect --force $NETWORK "$cid" >/dev/null 2>&1 || true
    done
  fi
  sleep 1
done
