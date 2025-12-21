# research.md

## Decision: Performance Goals

- Decision: Set initial target SLO for Git operations (clone/push) on small repositories to p95 < 2s.
- Rationale: Balances developer expectations and realistic CI environments; allows focused performance tests without overly strict targets.
- Alternatives considered: p95 < 500ms (too strict for networked containerized test infra), p95 < 5s (too loose).

## Decision: Key retrieval pattern

- Decision: `git-bridge` will use the internal authenticated web-profile API to retrieve user SSH keys (no direct DB reads), consistent with spec clarification.
- Rationale: Centralized ownership, consistent with security model and documented constraints.
- Alternatives considered: Direct DB read by `git-bridge` (rejected due to security/discovery policy).

## Decision: E2E reliability improvements

- Decision: Enhance Playwright flows to capture and assert the HTTP responses for POST /internal/api/users/:userId/ssh-keys and to write response bodies and status codes to `out/` artifacts for easier debugging.
- Rationale: Current symptoms (UI shows keys but DB queries sometimes empty) are best diagnosed by capturing server responses and correlating with server logs.
- Alternatives considered: Rely on server logs alone (insufficient for CI reproducibility) or mock backend (loses end-to-end verification).

## Decision: DB verification in E2E

- Decision: E2E scripts will query `sharelatex.usersshkeys` and search by the created user's `ObjectId` (extract userId from the UI or server responses). Add retries with exponential backoff to avoid race conditions between POST success and DB visibility.
- Rationale: Observed timing/race could cause transient empty results; retries make test robust while still validating persistence.

## Follow-ups / Unknowns (resolved)

- **Production SLO alignment**: Decision: Adopt the initial dev SLO as the default for this feature: p95 < 2s for small repos and p99 < 10s. Rationale: this target balances operational feasibility with user expectations; Product/Ops will be notified and may adjust for production with a follow-up if needed.
- **Cross-team coordination**: Decision: Coordinate migration with Infra and Security teams via a short design review meeting and an RFC in `docs/` outlining that `git-bridge` will call the internal web-profile API using the established service-origin model (mTLS preferred, bearer token fallback). Action: schedule meeting and add stakeholders (Infra, Security, GitBridge maintainers, QA) to the feature's plan tasks.
- **CI runner sizing for perf job**: Decision: Start with a conservative resource profile for scheduled perf runs in CI: 2 vCPU and 4GB RAM for the job runner. Rationale: perf harness will perform small repo clone/push tests and does not require large machines; size can be increased if CI results indicate flakiness. Action: open a follow-up ticket to confirm with CI/SRE and adjust runners as needed.

## Decision: Service authentication model

- **Decision**: Use the repository's existing _service-origin_ trust model: prefer **mTLS CN** where available; otherwise use a **trusted bearer service token** (in CI/dev, `X-Service-Origin` header may be used from a trusted ingress). Implement token-based authentication for `git-bridge` → web-profile with configurable trusted proxy settings for `X-Service-Origin` in dev.
- **Rationale**: The repo already documents and tests `service-origin` (docs/ssh-keys.md) and supports both mTLS and trusted bearer tokens. Using the existing model avoids large infra changes and integrates naturally with per-service rate-limiting and audit logging.
- **Alternatives considered**: mTLS-only (rejected for initial rollout due to operational complexity); gateway-only auth (requires infra changes).

## Decision: SSH authentication strategy

- **Decision**: Implement an in-process SSH server in `git-bridge` (Go) using a maintained Go SSH library which authenticates public keys by calling the internal web-profile API and then executes `git` operations (shelling out to system `git` for repository operations).
- **Rationale**: An in-process SSH server gives direct control over authentication and mapping of keys→user, simplifies per-connection authorization, and avoids system-level `sshd` configuration complexity inside containers. Delegating repository operations to the system `git` binary ensures robust, compatible Git behavior out-of-the-box.
- **Alternatives considered**: system `sshd` with AuthorizedKeysCommand (more complex in containers), `go-git` (considered but deferred for initial implementation because of feature parity/perf concerns).

## Decision: `go-git` vs system `git`

- **Decision**: Start by shelling out to **system `git`** (via `os/exec`) for repository operations and hooks, and keep `go-git` as an optional refactor path if performance or binary-dependency constraints demand it later.
- **Rationale**: System `git` is battle-tested, supports hooks/packfile semantics the project expects, and reduces the risk of subtle incompatibilities in push/pack negotiation.

## CI/performance test runner

- **Decision**: Add a lightweight performance harness under `services/git-bridge/test/perf/` that runs `git clone`/`git push` against a local Docker Compose stack and records p95/p99 latencies. Integrate as an optional CI job (smoke perf) that runs on schedule or on-demand.
- **Open items**: exact CI machine sizing and schedule (CI runner availability) — **NEEDS CLARIFICATION** with CI/SRE.

## Decision: Atomic upsert for SSH key create

- **Decision**: Replace insert-first + dedupe flow with an atomic `findOneAndUpdate(..., upsert: true)` (or equivalent) that returns the canonical document for a fingerprint. Use `$setOnInsert` for fields that should only be set on first insert.
- **Rationale**: Prevents races where concurrent POSTs both attempt insertion and one fails with 409 while leaving an inconsistent final state (observed in contract repro). Mongo's atomic find-and-update returns the final canonical doc and avoids extra dedupe passes.
- **Alternatives considered**: Redis/lock-based coordination (more complex), optimistic retries (less reliable), leaving current flow (proven flaky).

## Decision: Instrumentation for concurrent create diagnostics

- **Decision**: Add targeted server-side logs in the web create path capturing: computed fingerprint, request id, timestamp, findOneAndUpdate request payload, DB result (created vs existing), and any dedupe/canonicalize actions. Write to the existing `/tmp/ssh_upsert_debug.log` for test runs and to structured logs in production.
- **Rationale**: Existing repros show the stress fingerprint missing from logs; this instrumentation will provide chronological evidence to correlate test client attempts with DB state and server behavior.

## Decision: Contract tests for concurrent create

- **Decision**: Add a contract test that performs e.g. 40 concurrent POSTs for the same fingerprint and asserts: (a) no 409 conflict is returned; (b) clients receive either 201 (created) or 200 (already existed); (c) a single canonical DB document exists after the run; (d) final GET returns a non-empty list containing the fingerprint.
- **Rationale**: Encodes the desired idempotency behavior as a regression test and prevents reintroduction of the race.

## Decision: AuthManager cache TTL defaults

- **Decision**: Keep defaults (positive TTL = 60s, negative TTL = 5s) and make them configurable via env vars. Add tests that validate cache behavior and introspection fallback when lookup returns empty or network errors occur.
- **Rationale**: Short positive TTL allows fast auth while enabling timely propagation of key changes; negative TTL prevents repeated expensive misses.

Generated: automated research for Phase 0
