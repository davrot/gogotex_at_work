#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://develop-webpack-1:3808}

# Disallow localhost/127.0.0.1 for e2e scripts — tests must use the dev compose host on the docker network
if echo "$BASE_URL" | grep -E "localhost|127\.0\.0\.1" >/dev/null 2>&1; then
  echo "ERROR: BASE_URL must not be localhost or 127.0.0.1 for e2e scripts. Use the webpack dev host (e.g. http://develop-webpack-1:3808)."
  exit 2
fi
EMAIL=${1:-}
PASSWORD=${2:-}

if [ -z "$EMAIL" ]; then
  timestamp=$(date +%s)
  EMAIL="test+${timestamp}@example.com"
fi
if [ -z "$PASSWORD" ]; then
  PASSWORD="Test1234!"
fi

COOKIEJAR=$(mktemp)
HTML=$(mktemp)

echo "Fetching launchpad to get CSRF and cookies..."
curl -s -c "$COOKIEJAR" "$BASE_URL/launchpad" -o "$HTML"
CSRF=$(grep -oP "name='_csrf' type='hidden' value='\K[^']+" "$HTML" | head -n1)
if [ -z "$CSRF" ]; then
  echo "Failed to extract CSRF token from $BASE_URL/launchpad"
  rm -f "$COOKIEJAR" "$HTML"
  exit 1
fi

echo "Registering admin via launchpad: $EMAIL"
RESP=$(curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -X POST "$BASE_URL/launchpad/register_admin" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "_csrf=$CSRF" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASSWORD")

echo "launchpad response: $RESP"

# Login to get admin session
HTML2=$(mktemp)
echo "Fetching login page to get CSRF..."
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" "$BASE_URL/login" -o "$HTML2"
CSRF2=$(grep -oP "name='_csrf' type='hidden' value='\K[^']+" "$HTML2" | head -n1)
if [ -z "$CSRF2" ]; then
  echo "Failed to extract CSRF token from $BASE_URL/login"
  rm -f "$COOKIEJAR" "$HTML" "$HTML2"
  exit 1
fi

echo "Logging in as admin..."
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -X POST "$BASE_URL/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "_csrf=$CSRF2" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASSWORD" -D - | sed -n '1,4p'

# Fetch admin register page to get CSRF for admin action
HTML3=$(mktemp)
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" "$BASE_URL/admin/register" -o "$HTML3" || true
CSRF3=$(grep -oP "name='_csrf' type='hidden' value='\K[^']+" "$HTML3" | head -n1)
if [ -z "$CSRF3" ]; then
  echo "Failed to extract admin CSRF token; ensure the logged-in admin has access to /admin/register"
  rm -f "$COOKIEJAR" "$HTML" "$HTML2" "$HTML3"
  exit 1
fi

# Create test user via admin register
TEST_EMAIL=${3:-test+${timestamp}@example.com}

echo "Creating test user $TEST_EMAIL via /admin/register"
RESP2=$(curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -X POST "$BASE_URL/admin/register" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "_csrf=$CSRF3" --data-urlencode "email=$TEST_EMAIL")

echo "admin register response: $RESP2"

echo "Done. Created test user: $TEST_EMAIL (password will be a set-one-time link emailed to user)"
rm -f "$COOKIEJAR" "$HTML" "$HTML2" "$HTML3"
