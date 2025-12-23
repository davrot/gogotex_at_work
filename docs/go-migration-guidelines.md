Go Migration Guidelines

Overview

This short guideline formalizes how to structure migrations from Node.js microservices to Go in this repository.

Directory naming

- For each service migrated to Go, create a new directory under `services/` using the pattern `services/<name>-go`.
  - Examples: `services/contacts-go`, `services/project-history-go`.
- Keep the original implementation (e.g., `services/contacts`) untouched during initial migration so that the system can run both side-by-side when needed.

Contents and responsibilities

- The `-go` directory should contain the Go service implementation and any service-specific artifacts:
  - `main.go`, `internal/` package layout, `Dockerfile`, `README_POC.md`, `test/integration/` scripts, and CI snippets if required.
  - Add a GitHub Actions workflow using `docs/templates/service-go/ci-workflow.template` (or adapt your own). The workflow can optionally run `test/integration/run_integration.sh --remote-db-test` to execute the optional networked Go-level DB test via a helper container.
- Document the migration-specific decisions in `docs/GO_MIGRATION_HANDOVER.md` and link to the service-level README.

Testing & CI

- Unit tests (`go test`) and static checks (`golangci-lint`) should be runnable locally.
- Integration scripts should be able to run locally (using Docker) and be runnable in CI with minimal setup.

Naming & discovery

- The consistent `-go` suffix helps tooling, documentation, and reviewers quickly identify Go-based services and keeps the root `services/` directory organized.

Notes

- If a service requires a different suffix for clarity (e.g., `-go-poc`), document the reasons clearly in the service README.
- This guideline is intentionally lightweight; adjust it for decisions that need to be made per-service (e.g., monorepo vs multi-repo splits).
