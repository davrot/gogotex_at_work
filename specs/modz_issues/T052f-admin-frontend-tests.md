Title: T052f — Add frontend component tests for `modz/admin_extensions`

Description:
Add component and page tests (ProjectList, UserActivate) to validate UI behaviours (pagination, activation flows) in `modz/admin_extensions`.

Acceptance criteria:

- Add `@testing-library/react` tests for `ProjectList` component and `ProjectListPage` verifying pagination and rendering logic.
- Add tests covering `UserActivate` page interactions and server-edge-case handling (e.g., missing user).
- Tests run in CI and use lightweight mocks for server calls.

Owner: TBD
Estimate: 2-4 days
Blocking: Identification of representative real-world fixtures for pagination/activation.

Suggested labels: T052, P2, tests
