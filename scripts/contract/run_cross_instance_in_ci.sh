#!/usr/bin/env bash
set -euo pipefail

# Run the cross-instance client from the job runner using the standard node:18 image
# Usage: run_cross_instance_in_ci.sh <network> <instance1> <instance2>
NETWORK=${1:-webprofile-parity-net}
INSTANCE1=${2:-http://webprofile-api-parity:3900}
INSTANCE2=${3:-http://webprofile-api-parity-node2:3900}

GIT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

docker run --rm --network ${NETWORK} -e INSTANCE1="${INSTANCE1}" -e INSTANCE2="${INSTANCE2}" -v "${GIT_ROOT}:/workspace" -w /workspace node:18 node scripts/contract/cross_instance_client.js
