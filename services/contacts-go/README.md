# contacts-go (PoC)

Minimal PoC for migrating the `contacts` service to Go.

Endpoints:

- GET /health -> { status: "ok" } (increments `contacts_health_checks_total` metric)
- GET /metrics -> Prometheus metrics endpoint

Logging & metrics:

- Uses `go.uber.org/zap` for structured JSON logs (initialized on startup)
- Uses Prometheus `client_golang` to expose metrics at `/metrics`

Develop:

- make test
- make build
- make docker
