#!/usr/bin/env bash
set -euo pipefail

# Run contract messages test locally using a temporary Mongo container
# Usage: ./scripts/run_contract_local.sh

MONGO_CONTAINER_NAME=chat-contract-mongo-$$
MONGO_IMAGE=mongo:6.0
PORT=3011

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
export GO_PORT=${PORT}

# Run contract test (Node script ensures it connects and verifies persistence)
node test/contract/messages_contract_test.js

rc=$?

echo "Cleaning up Mongo container ${MONGO_CONTAINER_NAME}..."
docker rm -f ${MONGO_CONTAINER_NAME} >/dev/null || true

exit $rc
