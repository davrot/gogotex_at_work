#!/usr/bin/env bash
set -euo pipefail

# Wait for the Mongo replica set to be PRIMARY.
# Usage: wait-for-mongo.sh [mongo-host] [max-retries] [sleep-seconds]
# Defaults: mongo-host=mongo, max-retries=60, sleep=2

MONGO_HOST=${1:-mongo}
MAX_RETRIES=${2:-60}
SLEEP=${3:-2}

RETRIES=0
echo "Waiting for Mongo replica set to be PRIMARY at ${MONGO_HOST}:27017"
while true; do
  # Check if replset exists
  STATUS=$(mongosh --quiet --host "${MONGO_HOST}:27017" --eval 'try { var s = rs.status(); printjson({myState: s.myState}); } catch (e) { printjson({error: e.toString()}); }' | tr -d '\r') || true
  if echo "$STATUS" | grep -q 'myState" *: *1'; then
    echo "Mongo is PRIMARY"
    exit 0
  fi

  if echo "$STATUS" | grep -q 'error' ; then
    echo "Replica set not configured yet, attempting rs.initiate()..."
    # Attempt to initiate; ignore failures if already initiated.
    mongosh --quiet --host "${MONGO_HOST}:27017" --eval "try { rs.initiate({_id: 'overleaf', members:[{_id:0, host: '${MONGO_HOST}:27017'}]}); print('rs.initiate attempted'); } catch (e) { print('rs.initiate failed: ' + e); }" || true
  else
    echo "Replica set configured but not PRIMARY yet (status: $STATUS)"
  fi

  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    echo "Timed out waiting for Mongo to become PRIMARY after ${MAX_RETRIES} tries"
    exit 1
  fi
  sleep "$SLEEP"
done
