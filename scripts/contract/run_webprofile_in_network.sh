#!/usr/bin/env bash
set -euo pipefail

# Start the webprofile-api as a Docker container attached to the develop compose network
# Usage: ./scripts/contract/run_webprofile_in_network.sh [image_tag]
IMAGE_TAG=${1:-webprofile-api-ci}
NETWORK=${NETWORK:-develop_default}
MONGO_URI=${MONGO_URI:-mongodb://mongo:27017/sharelatex}

# Build the image
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
pushd "${REPO_ROOT}/services/git-bridge/cmd/webprofile-api" >/dev/null
docker build -t ${IMAGE_TAG} .
popd >/dev/null

# Remove existing container if present
docker rm -f ${IMAGE_TAG} >/dev/null 2>&1 || true

# Optionally publish host port; by default we run attached to network without publishing
PORT_ARG=""
if [ "${PUBLISH_PORT:-false}" = "true" ]; then
  PORT_ARG="-p 3900:3900"
fi

# Run attached to the compose network
docker run -d --name ${IMAGE_TAG} --network ${NETWORK} -e MONGO_URI="${MONGO_URI}" ${PORT_ARG} ${IMAGE_TAG}

echo "Started ${IMAGE_TAG} on network ${NETWORK}. Use http://${IMAGE_TAG}:3900 from other containers in the ${NETWORK} network."