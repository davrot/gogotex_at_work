# Spike: Port minimal chat endpoint to Go (proof-of-concept)

Goal: Validate the migration path for `services/chat` by porting a single, non-destructive read endpoint to Go and adding parity tests and CI job.

Scope (timeboxed to 3 days):
- Port `GET /internal/api/status` or similar read-only endpoint that does not require DB writes (getStatus already exists; choose `GET /internal/api/threads/:threadId` as a read-only endpoint if feasible or a trimmed `getGlobalMessages` that returns a limited dataset).
- Add unit tests for the new Go handler.
- Add a contract test that compares Node vs Go responses for the same request (parity assertion).
- Add a CI job that builds the Go binary and runs the parity test.

Acceptance Criteria:
- A PR exists implementing the Go endpoint, unit tests, parity test, and CI job.
- PR passes CI with parity test green.
- Document a short runbook describing steps to port further endpoints using the same pattern.

Risks & Mitigations:
- DB model differences: keep spike read-only and avoid introducing new persistence code.
- API contract drift: ensure parity test uses fixture data or mocks to avoid flakiness.

Next steps:
1. Triage and assign owner for the spike (issue #11 should reference this spike PR).
2. Implement the PR and iterate on feedback.
