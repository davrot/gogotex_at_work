#!/usr/bin/env bash
set -euo pipefail

# Usage: cross_instance_ci_runner.sh <instance1_base> <instance2_base>
INSTANCE1=${1:?}
INSTANCE2=${2:?}
USERID="ci-cross-$(date +%s%3N)"
AUTH_HEADER="-u overleaf:overleaf"

mkdir -p ci/webprofile-parity

# Iterations support: ENV CROSS_INSTANCE_ITERATIONS or 3 by default
ITERATIONS=${3:-${CROSS_INSTANCE_ITERATIONS:-3}}
NETWORK=${NETWORK:-webprofile-parity-net}
results_file="ci/webprofile-parity/cross-instance-results.json"
rm -f "$results_file"
jq -n '[]' > "$results_file"

for iter in $(seq 1 $ITERATIONS); do
  USERID="ci-cross-$(date +%s%3N)-$iter"
  echo "Iteration #$iter: creating token on $INSTANCE1 (user $USERID)"
  create_resp=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -X POST -H 'Content-Type: application/json' -d '{"label":"ci-cross","scopes":["repo:read"]}' "$INSTANCE1/internal/api/users/$USERID/git-tokens") || true
  echo "$create_resp" > "ci/webprofile-parity/cross-instance-create-iter-$iter.json"
  id=$(echo "$create_resp" | jq -r '.id // ._id // empty')
  # strip ObjectID("...") wrapper if present
  if echo "$id" | grep -q '^ObjectID("'; then
    id=$(echo "$id" | sed -E 's/^ObjectID\("([0-9a-fA-F]+)"\)$/\1/')
  fi
  token=$(echo "$create_resp" | jq -r '.token // .plaintext // empty')
  if [ -z "$id" ] || [ -z "$token" ]; then
    echo "Iteration $iter: Failed to create token"
    jq --argjson obj '{iteration:'$iter', success:false, reason:"create_failed"}' '. + [$obj]' "$results_file" > "$results_file.tmp" && mv "$results_file.tmp" "$results_file"
    continue
  fi

  echo "Iteration $iter: created id=$id token_present=$([ -n "$token" ] && echo yes || echo no)"

  # Revoke via instance2
  revoke_status=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -o /dev/null -w "%{http_code}" -u overleaf:overleaf -X DELETE "$INSTANCE2/internal/api/users/$USERID/git-tokens/$id" || true)
  echo "$revoke_status" > "ci/webprofile-parity/cross-instance-revoke-iter-$iter.txt"
  if [ "$revoke_status" != "204" ]; then
    echo "Iteration $iter: Revoke failed with status $revoke_status"
    jq --argjson obj '{iteration:'$iter', success:false, reason:"revoke_failed", revoke_status:'$revoke_status'}' '. + [$obj]' "$results_file" > "$results_file.tmp" && mv "$results_file.tmp" "$results_file"
    continue
  fi

  # Poll introspect on instance1 until inactive
  deadline=$(( $(date +%s) + 15 ))
  ok=false
  last_resp=''
  while [ $(date +%s) -lt $deadline ]; do
    resp=$(docker run --rm --network ${NETWORK} curlimages/curl -sS -u overleaf:overleaf -H 'Content-Type: application/json' -d "{\"token\":\"$token\"}" "$INSTANCE1/internal/api/tokens/introspect" || true)
    echo "$resp" > "ci/webprofile-parity/cross-instance-introspect-iter-$iter.raw"
    last_resp="$resp"
    # read active value from saved raw file
    active=$(jq '.active' "ci/webprofile-parity/cross-instance-introspect-iter-$iter.raw" || true)
    # normalize and trim
    active=$(echo "$active" | tr -d ' "\r\n' || true)
    if [ "$active" = "false" ]; then
      ok=true
      break
    fi
    sleep 0.2
  done

  if [ "$ok" = true ]; then
    jq --argjson obj '{iteration:'$iter', success:true}' '. + [$obj]' "$results_file" > "$results_file.tmp" && mv "$results_file.tmp" "$results_file"
  else
    jq --argjson obj '{iteration:'$iter', success:false, reason:"revocation_not_observed", last:'"$(echo "$last_resp" | sed "s/'/\\'/'/g" )"'}' '. + [$obj]' "$results_file" > "$results_file.tmp" && mv "$results_file.tmp" "$results_file"
  fi

done

echo "Wrote per-iteration results to $results_file"
# exit non-zero if any iteration failed
if jq -e 'any(.[]; .success == false)' "$results_file" >/dev/null; then
  exit 2
else
  exit 0
fi
