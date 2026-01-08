#!/bin/bash

# Integration test script for chat service with timeout protection
# This script ensures tests don't hang during development

set -e

echo "Running integration tests for chat service with timeout protection..."

# Run unit tests with timeout
echo "Running unit tests..."
timeout 30s go test -v ./cmd/chat

# Run acceptance tests with timeout
echo "Running acceptance tests..."
timeout 30s npm run test:acceptance

echo "All integration tests completed successfully!"