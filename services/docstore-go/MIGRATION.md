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
- [ ] implement in-memory store
- [ ] implement handlers and tests
- [ ] add integration script and CI snippet
- [ ] implement Postgres store and integration tests (opt-in)

Owner: @team-docstore
