Migration plan: chat-go

Goal

- Provide a Go implementation of the `chat` microservice that matches current API behaviour and is runnable locally.

Minimal scope (PoC)

- Add `/health` endpoint (done)
- Implement a minimal in-memory store for messages (List/Create)
- Implement HTTP handlers: GET /messages, POST /messages
- Add unit tests for store and handlers
- Add an integration script for quick smoke tests (Docker)

DB & Persistence

- Initially in-memory store for PoC
- If persistence needed later: add Postgres store using pgx and `services/chat-go/internal/store/postgres_store.go` with schema migrations

Observability & CI

- Expose Prometheus metrics `/metrics`
- Add golangci-lint config and CI snippet from `docs/templates/service-go/ci-snippet.template`

Checklist

- [ ] implement in-memory store and tests
- [ ] implement handlers and tests
- [ ] add integration script
- [ ] add Postgres store (if required) and integration tests
- [ ] add metrics and structured logging

Owner: @team-chat (assign as appropriate)
