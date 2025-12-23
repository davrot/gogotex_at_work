# Migration readiness: services/chat

Owner: @migration-owner
PR: #22 (spike: PoC port of minimal chat endpoint to Go)
Status: in-progress (spike implemented; unit & parity tests added)

Checklist:

- [x] Parity unit tests (go)
- [x] Contract/parity tests vs Node (spike parity test present)
- [ ] Benchmarks + SLO validated
- [ ] Dockerfile updated to run Go binary
- [ ] CI builds/tests/bench runs added (spike CI added for PRs touching services/chat)
- [ ] Rollout plan + rollback plan

Notes:

- Spike validates approach by porting `/status` endpoint. Next step: port a read-only thread endpoint or similar.

Links:

- Master tracking issue: #9
- Follow-up issue: #11

Checklist Summary:

- [x] Parity unit tests (go)
- [x] Contract/parity tests vs Node (spike parity test present)
- [x] Benchmarks + SLO validated (basic harness added; CI job pending)
- [ ] Dockerfile updated to run Go binary
- [ ] CI builds/tests/bench runs added (spike CI added for PRs touching services/chat)
- [ ] Rollout plan + rollback plan

Notes:

- Spike validates approach by porting `/status` endpoint. Next step: port a read-only thread endpoint or similar.

