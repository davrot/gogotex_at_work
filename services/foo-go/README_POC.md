# {{SERVICE_NAME}}-go

This is the Go implementation of the `{{SERVICE_NAME}}` service.

Quickstart

- Build: `docker build -t {{SERVICE_NAME}}-go:local .`
- Run: `docker run -p 8080:8080 -e PORT=8080 {{SERVICE_NAME}}-go:local`
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

You can run the service-level integration checks with the included Makefile targets (if present):

- `make -C services/foo-go integration`
- `make -C services/foo-go integration-remote`

The `integration-remote` target runs the script with `--remote-db-test` to perform an optional networked Go-level DB validation. Use these commands locally for fast feedback; CI can optionally invoke the same targets.
