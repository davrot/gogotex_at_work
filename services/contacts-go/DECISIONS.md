Decisions for contacts-go PoC

- Language & version: Go 1.21 for compatibility / build tools.
- HTTP framework: Gin (simple, well-known, performant).
- Logging: zap (structured JSON logging).
- Metrics: Prometheus via `client_golang` and `/metrics` endpoint; also add `contacts_request_duration_seconds` histogram for request timing.
- Linting: `golangci-lint` with `staticcheck` and `govet`.

Rationale:

- Gin is lightweight and maps well to our simple HTTP handlers.
- zap and Prometheus are industry-standard and easy to integrate with our observability stack.
