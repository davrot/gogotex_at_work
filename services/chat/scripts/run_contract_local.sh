#!/usr/bin/env bash
set -euo pipefail

# Run contract messages test locally using a temporary Mongo container
# This script avoids using 127.0.0.1/localhost so it works from inside dev containers.
# Usage: ./scripts/run_contract_local.sh

MONGO_CONTAINER_NAME=chat-contract-mongo-$$
MONGO_NETWORK=chat-contract-net-$$
MONGO_IMAGE=mongo:6.0

echo "Creating docker network ${MONGO_NETWORK}..."
docker network create ${MONGO_NETWORK} >/dev/null

echo "Starting Mongo container ${MONGO_CONTAINER_NAME} on network ${MONGO_NETWORK}..."
docker run -d --name ${MONGO_CONTAINER_NAME} --network ${MONGO_NETWORK} ${MONGO_IMAGE} >/dev/null

# Wait for Mongo ready
for i in {1..30}; do
  if docker exec ${MONGO_CONTAINER_NAME} mongo --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
    echo "Mongo is ready"
    break
  fi
  sleep 1
done

MONGO_URI="mongodb://${MONGO_CONTAINER_NAME}:27017/chat_test"
echo "Using MONGO_URI=${MONGO_URI}"

# Run the Node contract test inside a temporary Node container attached to the same network
# so it can reach Mongo by container name. This avoids relying on host binding.
echo "Running Node contract tests in a temporary node container..."
docker run --rm --network ${MONGO_NETWORK} -v "$PWD":/workspace -w /workspace node:22 sh -lc "npm ci --silent && MONGO_URI='${MONGO_URI}' node test/contract/messages_contract_test.js"
rc=$?

echo "Cleaning up Mongo container and network..."
docker rm -f ${MONGO_CONTAINER_NAME} >/dev/null || true
docker network rm ${MONGO_NETWORK} >/dev/null || true

exit $rc
