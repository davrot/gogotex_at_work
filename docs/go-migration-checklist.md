Go Migration Checklist

Use this checklist when creating a new `services/<name>-go` migration to ensure consistency across services.

- [ ] Create the new directory `services/<name>-go` (use `bin/create-go-service <name>` as a starting point)
- [ ] Add `README_POC.md` and link to `docs/go-migration-guidelines.md`
- [ ] Implement `main.go` and `internal/` package layout (`server`, `handlers`, `store`)
- [ ] Add unit tests (`go test ./...`)
- [ ] Add `Dockerfile` using `docs/templates/service-go/Dockerfile.template`
- [ ] Add `test/integration/run_integration.sh` for local Docker-based checks
- [ ] Add `golangci-lint` config if needed and verify `golangci-lint run ./...` passes
- [ ] Add CI snippet from `docs/templates/service-go/ci-snippet.template` into repo workflows
- [ ] Update `docs/GO_MIGRATION_HANDOVER.md` and add service-specific notes
- [ ] Add release/migration notes and update any cross-service documentation
- [ ] Verify integration script runs locally and in CI (where applicable)
- [ ] Create a small handover note for the original service owners
