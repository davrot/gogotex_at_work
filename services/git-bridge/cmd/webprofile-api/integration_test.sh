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
  # Use /dev/tcp to probe port in environments without netcat
  if (echo > /dev/tcp/localhost/3900) >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# Unauthenticated POST should redirect (302)
POST_UNAUTH_CODE=$(curl -s -o /tmp/integration_post_unauth.json -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"public_key":"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCint","key_name":"int-test"}' http://localhost:3900/internal/api/users/integration-user/ssh-keys)
if [ "$POST_UNAUTH_CODE" -ne 302 ]; then
  echo "Expected unauthenticated POST to return 302, got $POST_UNAUTH_CODE"
  cat /tmp/go_webprofile_integration.log || true
  exit 1
fi

# Authenticated POST should succeed (201 or 200)
POST_AUTH_CODE=$(curl -s -o /tmp/integration_post_auth.json -w "%{http_code}" -u "overleaf:overleaf" -X POST -H "Content-Type: application/json" -d '{"public_key":"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCint2","key_name":"int-test-2"}' http://localhost:3900/internal/api/users/integration-user/ssh-keys)
if [ "$POST_AUTH_CODE" -ne 201 ] && [ "$POST_AUTH_CODE" -ne 200 ]; then
  echo "Expected authenticated POST to return 201 or 200, got $POST_AUTH_CODE"
  cat /tmp/go_webprofile_integration.log || true
  exit 1
fi

# Unauthenticated GET should redirect (302)
GET_UNAUTH_CODE=$(curl -s -o /tmp/integration_get_unauth.json -w "%{http_code}" http://localhost:3900/internal/api/users/integration-user/ssh-keys)
if [ "$GET_UNAUTH_CODE" -ne 302 ]; then
  echo "Expected unauthenticated GET to return 302, got $GET_UNAUTH_CODE"
  cat /tmp/go_webprofile_integration.log || true
  exit 1
fi

# Authenticated GET should return 200 and JSON array
GET_AUTH_CODE=$(curl -s -u "overleaf:overleaf" -H "Accept: application/json" -o /tmp/integration_get_auth.json -w "%{http_code}" http://localhost:3900/internal/api/users/integration-user/ssh-keys)
if [ "$GET_AUTH_CODE" -ne 200 ]; then
  echo "Expected authenticated GET to return 200, got $GET_AUTH_CODE"
  cat /tmp/integration_get_auth.json || true
  cat /tmp/go_webprofile_integration.log || true
  exit 1
fi

# Introspection endpoint: unauthenticated should redirect (302)
INTROSPECT_UNAUTH_CODE=$(curl -s -o /tmp/introspect_unauth.json -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"token":"invalid-token"}' http://localhost:3900/internal/api/tokens/introspect)
if [ "$INTROSPECT_UNAUTH_CODE" -ne 302 ]; then
  echo "Expected unauthenticated introspect POST to return 302, got $INTROSPECT_UNAUTH_CODE"
  cat /tmp/go_webprofile_integration.log || true
  exit 1
fi

# Authenticated introspect with malformed token should return 400 + { message: 'invalid token format' }
INTROSPECT_AUTH_CODE=$(curl -s -u "overleaf:overleaf" -o /tmp/introspect_auth.json -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"token":"invalid-token"}' http://localhost:3900/internal/api/tokens/introspect)
if [ "$INTROSPECT_AUTH_CODE" -ne 400 ]; then
  echo "Expected authenticated introspect POST to return 400 for malformed token, got $INTROSPECT_AUTH_CODE"
  cat /tmp/introspect_auth.json || true
  cat /tmp/go_webprofile_integration.log || true
  exit 1
fi
if ! grep -q '"message"[[:space:]]*:[[:space:]]*"invalid token format"' /tmp/introspect_auth.json; then
  echo "Expected introspect response to include message: 'invalid token format' for malformed token"
  cat /tmp/introspect_auth.json || true
  exit 1
fi

echo "Integration tests passed"

# cleanup
kill $PID
wait $PID 2>/dev/null || true
exit 0
