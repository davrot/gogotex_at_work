# web-go

This is the Go implementation of the `web` service.

Quickstart

- Build: `docker build -t web-go:local .`
- Run: `docker run -p 8080:8080 -e PORT=8080 web-go:local`
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

- `make -C services/web-go integration`
- `make -C services/web-go integration-remote`

The `integration-remote` target runs `test/integration/run_integration.sh --remote-db-test` to perform an optional networked Go-level DB validation inside a helper container. Use these commands locally for fast feedback; CI can optionally invoke the same targets.
