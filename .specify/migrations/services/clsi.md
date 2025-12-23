# Migration readiness: services/clsi

Owner: @migration-owner
PR: N/A
Status: ready

Checklist:

- [x] Parity unit tests (go)
- [x] Contract/parity tests vs Node (if applicable)
- [x] Benchmarks + SLO validated (sandboxing tests)
- [x] Dockerfile updated to run Go binary
- [x] CI builds/tests/bench runs added
- [x] Rollout plan + rollback plan

Notes:

- CLI/sandbox requires additional security tests; ensure sandboxing harness is part of readiness criteria.

Links:

- Tasks: T052
