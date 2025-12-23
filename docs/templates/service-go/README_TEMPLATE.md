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
