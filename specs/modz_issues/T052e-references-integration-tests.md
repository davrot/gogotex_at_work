Title: T052e — Add frontend integration tests for `modz/references`

Description:
Add integration tests to validate the references frontend behavior with a mocked worker and sample indexed data.

Acceptance criteria:

- Add integration tests for `ReferencePickerModal` and `reference-indexer` that simulate worker responses and user interactions.
- Tests run in CI (no external network) and mock worker messages (use TestWorker) and fixture data.
- Add any required sample fixtures under `modz/references/test/fixtures/`.

Owner: TBD
Estimate: 2-3 days
Blocking: None (just test harness & fixtures)

Notes:

- Unit tests for `ReferenceIndexer` are present (see `modz/references/services/web/test/unit/reference-indexer.test.mjs`).
- Prefer `@testing-library/react` + jest/dom matchers for interactions and `vitest` for execution.

Suggested labels: T052, P2, tests
