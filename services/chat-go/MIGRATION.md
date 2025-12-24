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

Checklist (updated 2025-12-24)

- [x] implement in-memory store and tests — implemented (`internal/store/mem_store.go`, `mem_store_test.go`)
- [x] implement handlers and tests — implemented (`main.go`, `handlers_test.go`)
- [x] add integration script — implemented (`test/integration/run_integration.sh`)
- [x] add Postgres store and integration tests — implemented (`internal/store/postgres_store.go`, `postgres_store_sqlmock_test.go`, `postgres_integration_test.go`). Run local integration with `RUN_DB_INTEGRATION=1`.
- [x] add metrics and structured logging — implemented: `/metrics` endpoint (Prometheus), zap-based structured logging in `main.go`, and `.golangci.yml` added. CI template already includes `golangci-lint` job under `ci/ci-workflow.template`. Integration script verifies `/metrics` endpoint as part of smoke checks.
- [x] implement all missing endpoints for complete API parity — implemented all endpoints including:
  - Thread resolution (`POST /project/{projectId}/thread/{threadId}/resolve`)
  - Thread reopening (`POST /project/{projectId}/thread/{threadId}/reopen`)
  - Thread deletion (`POST /project/{projectId}/thread/{threadId}/delete`)
  - Message editing (`PUT /project/{projectId}/messages/{messageId}` and `PUT /project/{projectId}/thread/{threadId}/messages/{messageId}`)
  - Message deletion (`DELETE /project/{projectId}/messages/{messageId}` and `DELETE /project/{projectId}/thread/{threadId}/messages/{messageId}`)
  - Project destruction (`DELETE /project/{projectId}`)
  - Thread duplication (`POST /project/{projectId}/threads/duplicate`)
  - Resolved thread IDs (`GET /project/{projectId}/threads/resolved`)

Notes & next steps

- DB integration tests are present but gated behind `RUN_DB_INTEGRATION` / `RUN_DB_INTEGRATION_REMOTE` env vars to avoid accidental runs in CI/dev environments.
- The integration script runs Postgres mode on a Docker network and supports a remote helper mode for Go-level tests.
- All API endpoints are now implemented for complete drop-in replacement compatibility.

Owner: @team-chat (assign as appropriate)
