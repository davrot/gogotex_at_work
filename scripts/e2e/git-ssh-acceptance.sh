#!/usr/bin/env bash
set -euo pipefail

# Simple acceptance test for git-over-SSH against git-bridge (dev)
# Usage: ./scripts/e2e/git-ssh-acceptance.sh <userId> <git_bridge_host> <ssh_port>

USER_ID=${1:-user123}
GIT_HOST=${2:-}
SSH_PORT=${3:-22}

# Disallow localhost/127.* for acceptance scripts — require an explicit, resolvable git host on the dev compose network
if echo "${GIT_HOST:-}" | grep -E "localhost|127\.0\.0\.1" >/dev/null 2>&1; then
  echo "ERROR: GIT_HOST must not be localhost or 127.0.0.1 for acceptance tests. Set GIT_HOST to the git-bridge host on the dev compose network (for example, develop-git-bridge or the host part of BASE_URL)."
  exit 2
fi

TMPDIR=$(mktemp -d)
KEY=${TMPDIR}/id_ed25519
PUB=${KEY}.pub
ssh-keygen -t ed25519 -f "$KEY" -N '' -C 'e2e-test' >/dev/null
FP_LINE=$(ssh-keygen -lf "$PUB" -E sha256)
FP=$(echo "$FP_LINE" | awk '{print $2}')

echo "Seeding SSH key for user $USER_ID (fingerprint: $FP)"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/overleaf}" node services/web/tools/seed_ssh_key.mjs "$USER_ID" "$(cat $PUB)"

# Wait for git-bridge SSH port to be ready
echo "Waiting for git-bridge SSH on $GIT_HOST:$SSH_PORT..."
until nc -z "$GIT_HOST" "$SSH_PORT"; do
  sleep 1
done

# Create a small repo and attempt to connect via the generated key
REPO_DIR=$(mktemp -d)
cd "$REPO_DIR"
git init --bare origin.git
# Attempt to connect to the remote using the generated key
GIT_SSH_COMMAND="ssh -i $KEY -o StrictHostKeyChecking=no -p $SSH_PORT -l $USER_ID" git ls-remote "ssh://$GIT_HOST:$SSH_PORT/$(basename origin.git)" || true

echo "If the above shows refs then the SSH connection worked."

# Check git-bridge logs for structured auth events
echo "Checking git-bridge logs for auth.ssh_attempt events..."
LOGS=$(docker logs develop-git-bridge-1 --since 2m || true)
if echo "$LOGS" | grep -q "auth.ssh_attempt"; then
  echo "Recent auth.ssh_attempt entries:"
  echo "$LOGS" | grep "auth.ssh_attempt" | tail -n 20
else
  echo "No auth.ssh_attempt events found in git-bridge logs."
fi

# Assert we have an auth success for the fingerprint
if echo "$LOGS" | grep -q "\"fingerprint\": \"$FP\"" ; then
  if echo "$LOGS" | grep -q "\"fingerprint\": \"$FP\".*\"outcome\":\"success\"" ; then
    echo "Found auth success for fingerprint $FP"
  else
    echo "Fingerprint $FP seen, but no success outcome recorded"
    exit 2
  fi
else
  echo "Fingerprint $FP not found in recent logs"
  exit 2
fi

# Also assert we saw an RPC auth (repo allowed) event
if echo "$LOGS" | grep -q "\"repo\"" ; then
  if echo "$LOGS" | grep -q "\"repo\": .*\"outcome\":\"allowed\"" ; then
    echo "Found RPC auth event with repo allowed"
  else
    echo "RPC auth events found but none marked allowed"
    exit 3
  fi
else
  echo "No RPC auth.ssh_attempt events with repo found in recent logs"
  exit 3
fi

echo "Private key retained in $KEY for manual debugging (do not check into VCS)."

exit 0
