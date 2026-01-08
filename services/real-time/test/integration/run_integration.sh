#!/bin/bash

# Integration test script for real-time service with timeout protection
# This script ensures tests don't hang during development

set -e

echo "Running integration tests for real-time service with timeout protection..."

# Run unit tests with timeout
echo "Running unit tests..."
cd ../..
timeout 30s go test -v ./cmd/real-time

echo "All integration tests completed successfully!"