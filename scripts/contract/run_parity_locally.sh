#!/usr/bin/env bash
set -euo pipefail

# Run Go + Node parity checks against a local webprofile shim inside a Docker network
# Usage: ./scripts/contract/run_parity_locally.sh [--no-cleanup] [--keep-network]

CLEANUP=true
KEEP_NETWORK=false
for arg in "$@"; do
  case "$arg" in
    --no-cleanup) CLEANUP=false ;; 
    --keep-network) KEEP_NETWORK=true ;; 
    -h|--help) echo "Usage: $0 [--no-cleanup] [--keep-network]"; exit 0 ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

NETWORK=${NETWORK:-webprofile-parity-net}
MONGO_CONTAINER=${MONGO_CONTAINER:-webprofile-parity-mongo}
IMAGE_TAG=${IMAGE_TAG:-webprofile-api-parity}

mkdir -p ci/webprofile-parity

echo "Creating docker network ${NETWORK} (if missing)"
docker network create ${NETWORK} >/dev/null 2>&1 || true

echo "Starting Mongo (${MONGO_CONTAINER}) in network ${NETWORK}"
docker rm -f ${MONGO_CONTAINER} >/dev/null 2>&1 || true
docker run -d --name ${MONGO_CONTAINER} --network ${NETWORK} mongo:6.0.5

echo "Building + starting webprofile-api (${IMAGE_TAG}) in network ${NETWORK}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK=${NETWORK} MONGO_URI="mongodb://${MONGO_CONTAINER}:27017/sharelatex" "$REPO_ROOT/scripts/contract/run_webprofile_in_network.sh" ${IMAGE_TAG}

# Wait for server to respond on port (any HTTP status ok)
for i in $(seq 1 30); do
  code=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -o /dev/null -w "%{http_code}" http://${IMAGE_TAG}:3900/ || true)
  if [ -n "$code" ]; then
    echo "webprofile-api responded with HTTP status $code"
    break
  fi
  sleep 1
done

# Run Go parity (timeout 120s)
echo "Running Go parity tests (timeout 120s)"
if timeout 120s docker run --rm \
  -v "${REPO_ROOT}:/workspace" \
  --network ${NETWORK} -e MONGO_URI="mongodb://${MONGO_CONTAINER}:27017" -e TARGET_BASE_URL="http://${IMAGE_TAG}:3900" -w /workspace golang:1.25 bash -lc "mkdir -p ci/webprofile-parity && echo '=== START PARITY TESTS ===' > /workspace/ci/webprofile-parity/test.parity.out && cd services/git-bridge && echo '=== TestIntrospectIntegration_Bcrypt ===' >> /workspace/ci/webprofile-parity/test.parity.out && go test ./test/contract -run TestIntrospectIntegration_Bcrypt -v 2>&1 | tee -a /workspace/ci/webprofile-parity/test.parity.out ; echo '=== TestTokenCreateIntrospectRevokeIntegration ===' >> /workspace/ci/webprofile-parity/test.parity.out && go test ./test/contract -run TestTokenCreateIntrospectRevokeIntegration -v 2>&1 | tee -a /workspace/ci/webprofile-parity/test.parity.out"; then
  echo "Go parity tests finished (output: ci/webprofile-parity/test.parity.out)"
else
  echo "Go parity tests timed out or failed. See ci/webprofile-parity/test.parity.out"
fi

# Run Node parity (timeout 180s)
echo "Running Node parity smoke (timeout 180s)"
if timeout 180s docker run --rm \
  --network ${NETWORK} \
  -e TARGET_BASE_URL="http://${IMAGE_TAG}:3900" \
  -v "${REPO_ROOT}:/workspace" \
  -w /workspace \
  node:18 \
  node scripts/contract/node_parity.js > ci/webprofile-parity/node.parity.out 2>&1; then
  echo "Node parity smoke finished (output: ci/webprofile-parity/node.parity.out)"
else
  echo "Node parity smoke timed out or failed. See ci/webprofile-parity/node.parity.out"
fi

# Gather logs (local helper)
echo "Collecting container logs to ci/webprofile-parity/"
docker logs --tail 500 ${IMAGE_TAG} > ci/webprofile-parity/webprofile.log || true
docker logs --tail 500 ${MONGO_CONTAINER} > ci/webprofile-parity/mongo.log || true

# Bundle artifacts locally
if [ -d "ci/webprofile-parity" ]; then
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  OUT_FILE=ci/webprofile-parity-${TIMESTAMP}.tar.gz
  tar -czf "$OUT_FILE" -C ci webprofile-parity || true
  echo "Wrote bundle: $OUT_FILE"
fi


if [ "$CLEANUP" = true ]; then
  echo "Cleaning up containers"
  docker rm -f ${IMAGE_TAG} >/dev/null 2>&1 || true
  docker rm -f ${MONGO_CONTAINER} >/dev/null 2>&1 || true
  if [ "$KEEP_NETWORK" = false ]; then
    docker network rm ${NETWORK} >/dev/null 2>&1 || true
  fi
fi

echo "Parity run complete. Artifacts:
  - ci/webprofile-parity/test.parity.out
  - ci/webprofile-parity/node.parity.out"

exit 0
