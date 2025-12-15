#!/usr/bin/env bash
set -euo pipefail

# First SSH acceptance script (dev only).
# - Starts mongo, web, git-bridge
# - Generates an ssh keypair
# - Seeds the public key into Mongo (sharelatex.usersshkeys)
# - Verifies git-bridge can lookup the fingerprint via web-profile API

COMPOSE_FILE=develop/docker-compose.yml
USER_ID=${1:-user1}

echo "Starting required services (mongo, web, git-bridge)..."
docker compose -f "$COMPOSE_FILE" up -d mongo web git-bridge

echo "Generating temporary ssh keypair..."
TMPDIR=$(mktemp -d)
KEY_PATH="$TMPDIR/testkey"
ssh-keygen -t ed25519 -f "$KEY_PATH" -N '' -C 'e2e-test' >/dev/null
PUB="$KEY_PATH.pub"

echo "Computing fingerprint..."
# ssh-keygen output like: "256 SHA256:abc... user (ED25519)"
FP_LINE=$(ssh-keygen -lf "$PUB" -E sha256)
if ! echo "$FP_LINE" | grep -q SHA256; then
  echo "Failed to compute SHA256 fingerprint: $FP_LINE"
  exit 1
fi
FP=$(echo "$FP_LINE" | awk '{print $2}')

echo "Fingerprint: $FP"

# Wait for web to be ready by polling fingerprint lookup for a non-existing fingerprint
echo "Waiting for web to be ready (checking /internal/api/ssh-keys)..."
RETRIES=30
for i in $(seq 1 $RETRIES); do
  if docker compose -f "$COMPOSE_FILE" exec -T git-bridge curl -sS -o /dev/null -w "%{http_code}" "http://web:3000/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" 2>/dev/null | grep -qE "^(404|200|429)$"; then
    echo "web appears ready"
    break
  fi
  echo "waiting... ($i/$RETRIES)"
  sleep 2
  if [ "$i" -eq "$RETRIES" ]; then
    echo "Timeout waiting for web service"
    exit 2
  fi
done

# Seed the key into Mongo via the Node seeder (use host->mongodb port mapping)
echo "Seeding SSH key into Mongo (user=${USER_ID})..."
MONGO_URI=${MONGO_URI:-mongodb://127.0.0.1:27017/sharelatex}
NODE_PATH=.
MONGO_URI="$MONGO_URI" node services/web/tools/seed_ssh_key.mjs "$USER_ID" "$PUB"

# Verify git-bridge can lookup the fingerprint
echo "Verifying git-bridge can lookup fingerprint via web-profile API..."
HTTP_CODE=$(docker compose -f "$COMPOSE_FILE" exec -T git-bridge curl -sS -o /dev/null -w "%{http_code}" "http://web:3000/internal/api/ssh-keys/$FP" || true)
if [ "$HTTP_CODE" = "200" ]; then
  echo "Lookup success: git-bridge (via web) found user for $FP"
  docker compose -f "$COMPOSE_FILE" exec -T git-bridge curl -sS "http://web:3000/internal/api/ssh-keys/$FP" | jq
else
  echo "Lookup failed (HTTP status $HTTP_CODE). Check services and logs."
  exit 1
fi

echo "First-stage acceptance: fingerprint lookup works. To perform a full SSH auth test, follow the README instructions (attempt an SSH connection to git-bridge presenting the generated private key)."

echo "Key files left in: $TMPDIR (private key: testkey)"

# Do not remove tmpdir so user can use the private key to attempt ssh
exit 0
