# Multi-Instance Integration Tests for Chat Service

This directory contains integration tests that verify the chat service works correctly in multi-instance deployments.

## Test Structure

The integration tests ensure:
1. The service can handle concurrent requests without hanging
2. All endpoints are functional in a multi-instance scenario
3. Timeout protection prevents hanging during development
4. Service readiness is maintained across instances

## Running Tests

To run the integration tests with timeout protection:

```bash
# Run unit tests with timeout
timeout 30s go test -v ./cmd/chat

# Run integration tests with timeout
timeout 30s go test -v ./test/integration
```

## Multi-Instance Verification

The tests verify that:
- The service can be started multiple times without conflicts
- Endpoints respond correctly under concurrent access
- Timeout mechanisms prevent hanging during development
- All functionality is preserved in multi-instance deployments