#!/usr/bin/env bash
set -euo pipefail

# Usage: cross_instance_ci_runner.sh <instance1_base> <instance2_base>
INSTANCE1=${1:?}
INSTANCE2=${2:?}
USERID="ci-cross-$(date +%s%3N)"
AUTH_HEADER="-u overleaf:overleaf"

mkdir -p ci/webprofile-parity

# Create token on instance1
NETWORK=${NETWORK:-webprofile-parity-net}
create_resp=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -X POST -H 'Content-Type: application/json' -d '{"label":"ci-cross","scopes":["repo:read"]}' "$INSTANCE1/internal/api/users/$USERID/git-tokens") || true
echo "create_resp: $create_resp" > ci/webprofile-parity/cross-instance-create.json
id=$(echo "$create_resp" | jq -r '.id // ._id // empty')
# strip ObjectID("...") wrapper if present
if echo "$id" | grep -q '^ObjectID("'; then
  id=$(echo "$id" | sed -E 's/^ObjectID\("([0-9a-fA-F]+)"\)$/\1/')
fi

token=$(echo "$create_resp" | jq -r '.token // .plaintext // empty')
if [ -z "$id" ] || [ -z "$token" ]; then
  echo "Failed to create token: $create_resp"
  exit 2
fi

echo "created id=$id token_present=$([ -n "$token" ] && echo yes || echo no)"

# Revoke via instance2
revoke_status=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -o /dev/null -w "%{http_code}" -u overleaf:overleaf -X DELETE "$INSTANCE2/internal/api/users/$USERID/git-tokens/$id" || true)
echo "revoke_status=$revoke_status" > ci/webprofile-parity/cross-instance-revoke.txt
if [ "$revoke_status" != "204" ]; then
  echo "Revoke failed with status $revoke_status"
  cat ci/webprofile-parity/cross-instance-revoke.txt
  exit 3
fi

# Poll introspect on instance1 until inactive
deadline=$(( $(date +%s) + 15 ))
last=''
ok=false
while [ $(date +%s) -lt $deadline ]; do
  resp=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -H 'Content-Type: application/json' -d "{\"token\":\"$token\"}" "$INSTANCE1/internal/api/tokens/introspect" || true)
  echo "$resp" > ci/webprofile-parity/cross-instance-introspect.raw
  echo "introspect: $resp" > ci/webprofile-parity/cross-instance-introspect.json
  # read active value from saved raw file to avoid shell variable piping issues
  active=$(jq '.active' ci/webprofile-parity/cross-instance-introspect.raw || true)
  # normalize and trim
  active=$(echo "$active" | tr -d ' \"\r\n' || true)
  echo "debug resp='$resp'" > ci/webprofile-parity/cross-instance-introspect.debug
  echo "debug active='$active' (len=$(echo -n "$active" | wc -c))" > ci/webprofile-parity/cross-instance-active.debug
  if [ "$active" = "false" ]; then
    ok=true
    echo "revocation observed"
    break
  fi
  sleep 0.2
done

if [ "$ok" = true ]; then
  exit 0
else
  echo "revocation not observed; last introspect: $resp"
  exit 4
fi
