#!/usr/bin/env bash
set -euo pipefail

# Start the webprofile-api as a Docker container attached to the develop compose network
# Usage: ./scripts/contract/run_webprofile_in_network.sh [image_tag]
IMAGE_TAG=${1:-webprofile-api-ci}
NETWORK=${NETWORK:-develop_default}
MONGO_URI=${MONGO_URI:-mongodb://mongo:27017/sharelatex}

# Build the image
pushd services/git-bridge/cmd/webprofile-api >/dev/null
docker build -t ${IMAGE_TAG} .
popd >/dev/null

# Remove existing container if present
docker rm -f ${IMAGE_TAG} >/dev/null 2>&1 || true

# Run attached to the compose network
docker run -d --name ${IMAGE_TAG} --network ${NETWORK} -e MONGO_URI="${MONGO_URI}" -p 3900:3900 ${IMAGE_TAG}

echo "Started ${IMAGE_TAG} on network ${NETWORK} (port 3900 published to host). Use http://webprofile-api-ci:3900 from other containers in the ${NETWORK} network."