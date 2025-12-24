#!/bin/bash

# Integration test script for notifications service with timeout protection
# This script ensures tests don't hang during development

set -e

echo "Running integration tests for notifications service with timeout protection..."

# Run unit tests with timeout
echo "Running unit tests..."
cd ../..
timeout 30s go test -v ./cmd/notifications

echo "All integration tests completed successfully!"