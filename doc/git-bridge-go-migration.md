# Git-bridge Go Migration Plan (summary)

This document summarizes the Phase 0 migration of `services/git-bridge` from Java/Maven to Go.

What was done (Phase 0):

- Added a Go module skeleton in `services/git-bridge` (`go.mod`, `cmd/gitbridge/`, `internal/`)
- Implemented a minimal HTTP health endpoint and unit tests (`/health`) to verify the binary runs
- Added `internal/repo` `SlugFromPath` implementation and unit tests + benchmark
- Added an `AuthManager` stub and unit test
- Added Makefile targets: `go-mod-tidy`, `go-build`, `go-test`, `go-bench`
- Added a GitHub Actions workflow `go-build-test.yml` to run `go test`, `go vet`, build the binary, run an integration healthcheck, and run `golangci-lint`
- Added a minimal bench harness under `ci/benchmarks/git-bridge-benchmark` to run `go test -bench`

Next steps (Phase 0 → Phase 1 handoff):

- Port core features (SSH server, fingerprint→user lookup, introspection client, membership checks) to Go with unit and contract tests
- Port integration and E2E tests to run against the Go binary (or maintain JS/contract tests and orchestrate them to target the Go binary)
- Add benchmark harness entries to the CI gating workflow to measure and enforce SLOs for key lookup and introspect endpoints once implemented
- Keep Java build & CI steps enabled during migration until parity and stability are proven in CI

How to build and run Go locally (developer steps):

- Install Go 1.21+ (see `services/git-bridge/README.md`)
- Run `make go-build` to compile the binary to `bin/git-bridge`
- Run `make go-test` to run the unit tests
- Run `make go-bench` to run Go benchmarks

Notes:

- Some dev environments may not have a local `go` binary available; the CI uses `actions/setup-go` and will exercise the Go tests/build as part of PR checks.
- Do not remove Java sources or CI jobs until parity is demonstrated and the ported test suite passes reliably in CI for a sustained period.
