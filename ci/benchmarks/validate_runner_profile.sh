#!/usr/bin/env bash
set -euo pipefail

# Validate runner has at least required vCPU and memory
REQUIRED_VCPUS=${REQUIRED_VCPUS:-2}
REQUIRED_MEM_GB=${REQUIRED_MEM_GB:-4}

# Get vcpu count
VCPUS=$(nproc --all 2>/dev/null || echo 1)
# Get memory in GB (integer)
MEM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
MEM_GB=$(( MEM_KB / 1024 / 1024 ))

echo "Runner detected: vcpus=$VCPUS, memory_gb=${MEM_GB}GB"

if [ "$VCPUS" -lt "$REQUIRED_VCPUS" ]; then
  echo "ERROR: insufficient vCPU: need >= $REQUIRED_VCPUS, found $VCPUS" >&2
  exit 1
fi

if [ "$MEM_GB" -lt "$REQUIRED_MEM_GB" ]; then
  echo "ERROR: insufficient memory: need >= ${REQUIRED_MEM_GB}GB, found ${MEM_GB}GB" >&2
  exit 1
fi

echo "Runner profile validation passed."