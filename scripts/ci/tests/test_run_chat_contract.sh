#!/usr/bin/env bash
set -euo pipefail

# Test that the wrapper behaves reasonably when Docker is not available
# and NO_DOCKER=1 is set but MONGO_URI is missing.

NO_DOCKER=1
export NO_DOCKER

if scripts/contract/run_chat_contract.sh 2>&1 | tee /tmp/run_chat_contract_test.out; then
  echo "Expected failure when NO_DOCKER=1 and MONGO_URI unset" >&2
  exit 1
else
  if grep -q "MONGO_URI required" /tmp/run_chat_contract_test.out; then
    echo "Owners checker OK"
    exit 0
  else
    echo "Unexpected output:" >&2
    cat /tmp/run_chat_contract_test.out >&2
    exit 2
  fi
fi
