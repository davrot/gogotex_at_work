#!/usr/bin/env bash
set -euo pipefail

# Run a multi-instance integration harness locally using a temporary Mongo container
# Usage: ./scripts/run_multi_instance_local.sh

MONGO_CONTAINER_NAME=chat-multi-mongo-$$
MONGO_IMAGE=mongo:6.0
PORT_A=${PORT_A:-3011}
PORT_B=${PORT_B:-3012}
GO_RUN_TIMEOUT=${GO_RUN_TIMEOUT:-120s}

echo "Starting Mongo container ${MONGO_CONTAINER_NAME}..."
docker run -d --name ${MONGO_CONTAINER_NAME} -p 27017:27017 ${MONGO_IMAGE} >/dev/null

# Wait for Mongo ready
for i in {1..30}; do
  if docker exec ${MONGO_CONTAINER_NAME} mongo --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
    echo "Mongo is ready"
    break
  fi
  sleep 1
done

export MONGO_URI="mongodb://127.0.0.1:27017/chat_test"

# Start two Go instances bound to different ports
echo "Starting Go instance A on port ${PORT_A}..."
bash -lc "PORT=${PORT_A} timeout ${GO_RUN_TIMEOUT} go run ./cmd/chat" &
GO_PID_A=$!

echo "Starting Go instance B on port ${PORT_B}..."
bash -lc "PORT=${PORT_B} timeout ${GO_RUN_TIMEOUT} go run ./cmd/chat" &
GO_PID_B=$!

# Wait for readiness
for i in {1..30}; do
  if curl -sfS "http://127.0.0.1:${PORT_A}/status" >/dev/null 2>&1 && curl -sfS "http://127.0.0.1:${PORT_B}/status" >/dev/null 2>&1; then
    echo "Both instances are ready"
    break
  fi
  sleep 1
done

# Run the integration test
node test/integration/multi_instance_test.js
rc=$?

echo "Cleaning up: killing Go instances and Mongo container..."
kill ${GO_PID_A} ${GO_PID_B} >/dev/null 2>&1 || true

docker rm -f ${MONGO_CONTAINER_NAME} >/dev/null || true

exit $rc
