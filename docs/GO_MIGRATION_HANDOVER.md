Go migration PoC handover

What I implemented (PoC - `services/contacts-go`):

- Minimal Go service with `main.go`, `internal/server`, and unit test for `/health`.
- Structured logging using `go.uber.org/zap` (`internal/logging`).
- Request logging middleware (`internal/middleware`) that assigns `X-Request-ID`, echoes it on responses, measures request duration and records `contacts_request_duration_seconds` histogram.
- Prometheus metrics (`internal/metrics`) exposing `/metrics` and a `contacts_health_checks_total` counter.
- Config helper `internal/config` to read `PORT` from environment (defaults to `8080`).
- Integration script: `services/contacts-go/test/integration/run_integration.sh` which builds the image, runs it, and validates `/health`, `/metrics`, and the `/contacts` endpoints (create/list and invalid JSON handling) using an ephemeral `curlimages/curl` container.
- CI workflow test: `.github/workflows/ci-contacts-go.yml` runs `go test`, installs and runs `golangci-lint`, builds Docker image, and runs the integration script.
- Lint config: `.golangci.yml` included in service directory.

Notes & next steps:

- Add request-duration histogram labels (method/path) if desired.
- Add request-timing histogram aggregation, buckets, and a Prometheus summary if needed.
- Add integration tests that run acceptance scenarios and run them in CI as needed.
- If we want to retain a tiny debug image with curl installed, we can add a small target for easier debugging; for production we keep minimal scratch image.

Front-end handover (paused work brief):

- Current blocking issue: front-end unit test collection fails due to unresolved imports (i18n resources, writefull, shared types) and Babel parsing issues.
- Current bootstrap mitigations: global React shim, module-resolver alias, minimal i18n stub; still need additional targeted stubs and alias mappings to isolate component tests.
- Recommended next steps for front-end team: add minimal stubs for heavy imports, tighten Babel/register presets, and run scoped mocha tests until collection stops failing; I left a focused branch and tests in `feat/ci-ssh-smoke`.

Contact me (or pick up the branch `feat/go-contacts-poc`) to continue: implement middleware request IDs across the app, add more metrics, add integration test coverage, and begin migrating a real endpoint with DB access.

---

## Migration directory convention (project-wide)

When migrating a Node.js microservice to Go, use the following directory convention to keep both implementations side-by-side and to make migration/reversion easy:

- Place the Go version in a new directory named `services/<name>-go`, e.g. `services/contacts-go` for the `services/contacts` service.
- Keep service-specific documentation and CI steps inside the new `-go` directory (Dockerfile, README, test scripts, workflow snippets), and reference the migration in `docs/GO_MIGRATION_HANDOVER.md`.
- Use the `-go` suffix consistently for all future Go migrations to make tooling, discovery, and migration automation straightforward.

Rationale: this keeps both language implementations clearly separated, avoids name collisions, and makes it simple to run both implementations during migration periods and experiments.
