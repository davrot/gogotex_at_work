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
- [x] Rollout plan + rollback plan (drafted: `.specify/migrations/services/chat-rollout.md`)

Notes:

- Spike validates approach by porting `/status` endpoint. Next step: port a read-only thread endpoint or similar.

Links:

- Master tracking issue: #9
- Follow-up issue: #11

Checklist Summary:

- [x] Parity unit tests (go)
- [x] Contract/parity tests vs Node (validation & roundtrip parity tests added)
- [x] Benchmarks + SLO validated (basic harness added; CI job pending)
- [x] Dockerfile added for Go runtime (`Dockerfile.go`, static binary); default Node Dockerfile not overwritten
- [ ] CI builds/tests/bench runs added (spike CI added for PRs touching services/chat)
- [x] Rollout plan + rollback plan (drafted: `.specify/migrations/services/chat-rollout.md`)
- [ ] Multi-instance integration harness added (T047f)

Artifacts & local CI runner

- Local contract run output and artifacts are written to `ci/chat-contract/` when running `scripts/contract/run_chat_contract.sh`.
- Use `NO_DOCKER=1 MONGO_URI="mongodb://host:27017/chat_test" scripts/contract/run_chat_contract.sh` to run against an existing Mongo in CI without Docker.
- `scripts/ci/tests/test_run_chat_contract.sh` validates wrapper behavior in environments without Docker (ensures explicit MONGO_URI requirement).

Notes:

- Spike validates approach by porting `/status` endpoint. Next step: port a read-only thread endpoint or similar.
