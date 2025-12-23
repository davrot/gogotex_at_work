# Migration readiness: services/web

Owner: @migration-owner
PR: N/A
Status: scaffolded

Checklist:

- [x] Go shims & initial health endpoints added
- [ ] Contract/parity tests for extracted components
- [ ] Benchmarks & SLO validation for extracted components
- [ ] Dockerfile and runtime integration
- [ ] Rollout plan for incremental cutover (component-by-component)

Notes:

- Web migration is incremental; only shims exist for now. Each extracted component requires its own readiness doc and sign-off.

Links:

- Tasks: T057
