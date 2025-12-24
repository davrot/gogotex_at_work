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

- Initially in-memory store for PoC (done)
- Postgres-backed store added using `database/sql` with `pgx` stdlib driver and `services/chat-go/internal/store/postgres_store.go` (schema + Create/List implemented)

Run DB integration tests:

- Local (ephemeral container):
  - RUN_DB_INTEGRATION=1 go test ./internal/store -run TestPostgresStoreIntegration -v
- Remote networked helper (runs Go-level tests inside helper container):
  - RUN_DB_INTEGRATION_REMOTE=1 go test ./internal/store -run TestPostgresStoreNetworked -v
- For CI/automation see `services/chat-go/ci/ci-snippet.template` for an example job snippet that runs `test/integration/run_integration.sh` with `RUN_DB_INTEGRATION=1`.

Integration checklist

- Prereqs
  - Docker and Go 1.25+ available locally.

- Unit & sqlmock tests
  - Command: `go test ./internal/store -run TestPostgresStore_ -v`
  - Expected: all sqlmock & robustness tests pass (context cancellations, deadlines, query/scan errors).

- Local integration (ephemeral Postgres container)
  - Command: `RUN_DB_INTEGRATION=1 bash test/integration/run_integration.sh`
  - Expected: ephemeral Postgres starts and in-container psql smoke checks pass.

- Remote networked Go-level tests (helper container)
  - Command: `RUN_DB_INTEGRATION=1 bash test/integration/run_integration.sh --remote-db-test`
  - Effect: spins helper container attached to Postgres network and runs `TestPostgresStoreRemoteInner`.
  - Expected: trigger-induced transient error handling, table-lock blocking behavior, concurrency and large-payload checks pass.

- Cleanup
  - If network or container remains: `docker rm -f <container>` and `docker network rm <network>`.

- CI / Opt-in Workflow
  - Add an example manual workflow that runs `test/integration/run_integration.sh --remote-db-test` with `RUN_DB_INTEGRATION=1` (keep DB-run opt-in).

- What to record on success
  - Record command, date, and helper outcome (e.g. "remote helper tests succeeded (trigger + lock tests passed)").

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
