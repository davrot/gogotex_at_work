PoC Notes:

- Requires Go >= 1.25 (tested with `go1.25.5`).

- Logging: `go.uber.org/zap` used with `internal/logging` wrapper. Logger is initialized at startup (in `main`) and is optional for handlers (guarded for tests).
- Metrics: `internal/metrics` registers a `contacts_health_checks_total` counter and exposes `/metrics`.
- Lint: `.golangci.yml` included; CI runs `golangci-lint`.
- CI: workflow added at `.github/workflows/ci-contacts-go.yml` to run tests, lint, and build a Docker image.

Next steps to expand PoC:

- Add a basic logging middleware to include request IDs and structured fields. (Implemented as `internal/middleware`.)
- The middleware echoes the `X-Request-ID` header back in responses.
- Add Prometheus histogram for request durations. (Implemented as `internal/metrics.RequestDuration`.)
- Add integration test that runs the Docker image and hits `/health`, `/metrics`, and `/contacts` endpoints (create/list and invalid JSON handling). (Implemented as `test/integration/run_integration.sh`.)
- Add a simple `config` package to read host/port from env and match existing services' settings. (Implemented as `internal/config`.)
