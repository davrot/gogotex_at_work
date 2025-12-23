#!/usr/bin/env bash
set -euo pipefail

# Run two webprofile instances and execute the cross-instance client
# Usage: ./scripts/contract/run_cross_instance_locally.sh [--no-cleanup]
CLEANUP=true
for arg in "$@"; do
  case "$arg" in
    --no-cleanup) CLEANUP=false ;;
    -h|--help) echo "Usage: $0 [--no-cleanup]"; exit 0 ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

NETWORK=${NETWORK:-webprofile-parity-net}
MONGO_CONTAINER=${MONGO_CONTAINER:-webprofile-parity-mongo}
IMAGE_TAG_BASE=${IMAGE_TAG_BASE:-webprofile-api-parity}
IMAGE_TAG1=${IMAGE_TAG1:-${IMAGE_TAG_BASE}-node1}
IMAGE_TAG2=${IMAGE_TAG2:-${IMAGE_TAG_BASE}-node2}

mkdir -p ci/webprofile-parity

echo "Creating docker network ${NETWORK} (if missing)"
docker network create ${NETWORK} >/dev/null 2>&1 || true

echo "Starting Mongo (${MONGO_CONTAINER}) in network ${NETWORK}"
docker rm -f ${MONGO_CONTAINER} >/dev/null 2>&1 || true
docker run -d --name ${MONGO_CONTAINER} --network ${NETWORK} mongo:6.0.5

# Start first instance
echo "Starting first webprofile instance: ${IMAGE_TAG1}"
NETWORK=${NETWORK} MONGO_URI="mongodb://${MONGO_CONTAINER}:27017/sharelatex" ./scripts/contract/run_webprofile_in_network.sh ${IMAGE_TAG1}

# Start second instance
echo "Starting second webprofile instance: ${IMAGE_TAG2}"
NETWORK=${NETWORK} MONGO_URI="mongodb://${MONGO_CONTAINER}:27017/sharelatex" ./scripts/contract/run_webprofile_in_network.sh ${IMAGE_TAG2}

# Wait for both to respond
for i in $(seq 1 30); do
  code1=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -o /dev/null -w "%{http_code}" http://${IMAGE_TAG1}:3900/ || true)
  code2=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -o /dev/null -w "%{http_code}" http://${IMAGE_TAG2}:3900/ || true)
  if [ -n "$code1" -a -n "$code2" ]; then
    echo "instances responded: ${code1}, ${code2}"
    break
  fi
  sleep 1
done

# Run cross-instance client via parity image
PARITY_IMAGE=${PARITY_IMAGE:-webprofile-node-parity:local}
if ! docker image inspect ${PARITY_IMAGE} >/dev/null 2>&1; then
  echo "Building parity image ${PARITY_IMAGE}"
  docker build -t ${PARITY_IMAGE} -f scripts/contract/Dockerfile.node-parity "$(cd "$(dirname "$0")/../.." && pwd)" || true
fi

echo "Running cross-instance client against ${IMAGE_TAG1} and ${IMAGE_TAG2}"
if docker run --rm --network ${NETWORK} -e INSTANCE1="http://${IMAGE_TAG1}:3900" -e INSTANCE2="http://${IMAGE_TAG2}:3900" -v "$(cd "$(dirname "$0")/../.." && pwd)/ci:/workspace/ci" ${PARITY_IMAGE} node /usr/local/bin/cross_instance_client.js > ci/webprofile-parity/cross-instance.out 2>&1; then
  echo "Cross-instance test succeeded"
else
  echo "Cross-instance test failed; see ci/webprofile-parity/cross-instance.out"
fi

# Collect logs
docker logs --tail 500 ${IMAGE_TAG1} > ci/webprofile-parity/webprofile-node1.log || true
docker logs --tail 500 ${IMAGE_TAG2} > ci/webprofile-parity/webprofile-node2.log || true

echo "Wrote artifacts to ci/webprofile-parity/"

if [ "$CLEANUP" = true ]; then
  echo "Cleaning up"
  docker rm -f ${IMAGE_TAG1} >/dev/null 2>&1 || true
  docker rm -f ${IMAGE_TAG2} >/dev/null 2>&1 || true
  docker rm -f ${MONGO_CONTAINER} >/dev/null 2>&1 || true
  docker network rm ${NETWORK} >/dev/null 2>&1 || true
fi

exit 0
