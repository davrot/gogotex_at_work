# Migration readiness: services/git-bridge

Owner: @migration-owner
PR: N/A
Status: ready

Checklist:

- [x] Parity unit tests (go)
- [x] Contract/parity tests vs Node
- [x] Benchmarks + SLO validated
- [x] Dockerfile updated to run Go binary
- [x] CI builds/tests/bench runs added
- [x] Rollout plan + rollback plan

Notes:
- `git-bridge` was ported to Go due to lack of Java maintainers. Parity scripts, benchmarks, and CI jobs are present; readiness sign-off pending owner confirmation.

Links:
- Tasks: T042, T041a
- Docs: services/git-bridge/README.md
