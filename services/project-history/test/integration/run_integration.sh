#!/bin/bash

# Integration test script for project-history service with timeout protection
# This script ensures tests don't hang during development

set -e

echo "Running integration tests for project-history service with timeout protection..."

# Run unit tests with timeout
echo "Running unit tests..."
timeout 30s go test -v ./cmd/project-history

echo "All integration tests completed successfully!"