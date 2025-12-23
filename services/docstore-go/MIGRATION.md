Migration plan: docstore-go

Goal

- Migrate document store endpoints from Node.js to a Go PoC that supports listing and creating documents, with tests and integration checks.

PoC tasks

- `/health` endpoint (done)
- Document model: id (UUID), title, body, created_at
- Store interface: List(ctx), Create(ctx, Document)
- Implement in-memory store + concurrency tests
- Handlers: GET /documents, POST /documents with validation (title required)
- Unit tests for store and handlers
- Integration script (Docker) to exercise API

DB & Migrations

- Add Postgres store with schema migration when ready; use `pgcrypto` for UUID generation or generate in Go

Observability

- Add /metrics and request duration histogram

Checklist

- [X] implement in-memory store
- [X] implement handlers and tests
- [X] add integration script and CI snippet
- [X] implement Postgres store and integration tests (opt-in)

How to run integration tests

- Build and run the full integration flow (includes Postgres smoke tests and optional remote Go helper):

  - make integration        # smoke test (starts service image and Postgres, runs API checks)
  - make integration-remote # same as above + runs helper Go-level DB test inside helper container

- Direct tests inside module:

  - RUN_DB_INTEGRATION=1 go test ./internal/store -run TestPostgresStoreIntegration -v
  - RUN_DB_INTEGRATION_REMOTE=1 go test ./internal/store -run TestPostgresStoreNetworked -v

Notes

- Integration tests use in-container psql fallback so they work even when host port mapping is unreliable. The remote helper test exercises `NewPostgresStore` by running the Go test inside a helper container attached to the Postgres container's network. If your environment cannot mount the workspace into helper containers, the remote helper test may be skipped or fail with `go: go.mod file not found` (the integration script detects this and skips remote validation).

Owner: @team-docstore
