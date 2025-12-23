# docstore-go

This is the Go implementation of the `docstore` service.

Quickstart

- Build: `docker build -t docstore-go:local .`
- Run: `docker run -p 8080:8080 -e PORT=8080 docstore-go:local`
- Tests: `go test ./...`

Contents

- `main.go` — application entrypoint
- `internal/` — packages (server, handlers, store)
- `Dockerfile` — optimized multi-stage build for Go 1.25
- `test/integration/` — integration scripts and helpers

Notes

- Follow repository `docs/go-migration-guidelines.md` and the `services/<name>-go` convention.
- Add a `README_POC.md` if this is a PoC.

## Integration & Makefile

Add `Makefile` targets (if applicable) to make running integration checks easy locally:

- `make -C services/docstore-go integration` — smoke test (builds image, starts service + Postgres, checks /health and basic create/list)
- `make -C services/docstore-go integration-remote` — same as above + runs `--remote-db-test` which performs a Go-level DB validation inside a helper container (useful when your environment supports mounting the workspace into helper containers)

How to run the tests directly:

- RUN_DB_INTEGRATION=1 go test ./internal/store -run TestPostgresStoreIntegration -v
- RUN_DB_INTEGRATION_REMOTE=1 go test ./internal/store -run TestPostgresStoreNetworked -v

Notes:
- The integration scripts prefer in-container `psql` checks as a robust fallback when host port mapping or environment restrictions make direct DB connections unreliable.
- When `--remote-db-test` is used, the script will attempt to run Go tests inside a helper container; if the helper cannot access `go.mod` (mounting not supported), the script will detect and skip the remote helper tests with a helpful message.
