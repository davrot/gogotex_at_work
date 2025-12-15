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

## Follow-ups / Unknowns

- Verify whether production SLOs differ from the initial dev SLO and update targets accordingly (NEEDS CLARIFICATION from product/ops).
- Confirm any cross-team coordination required to migrate git-bridge to internal API-only access (stakeholders: infra, security, git-bridge maintainers).

Generated: automated research for Phase 0
