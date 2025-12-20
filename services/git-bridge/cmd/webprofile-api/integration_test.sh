#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# start server in background
GO_CMD="go run main.go"
$GO_CMD > /tmp/go_webprofile_integration.log 2>&1 &
PID=$!
trap 'kill $PID || true; wait $PID 2>/dev/null || true' EXIT
# wait for server to open port
for i in {1..20}; do
  if nc -z localhost 3900; then
    break
  fi
  sleep 0.2
done
# POST
curl -s -X POST -H "Content-Type: application/json" -d '{"public_key":"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCint","key_name":"int-test"}' http://localhost:3900/internal/api/users/integration-user/ssh-keys -o /tmp/integration_post.json -w "%{http_code}"
POST_CODE=$(cat /tmp/integration_post.json | jq -r '.created_at' >/dev/null 2>&1; echo $? || true)
# GET
curl -s http://localhost:3900/internal/api/users/integration-user/ssh-keys -o /tmp/integration_get.json
cat /tmp/integration_get.json
# cleanup
kill $PID
wait $PID 2>/dev/null || true
exit 0
