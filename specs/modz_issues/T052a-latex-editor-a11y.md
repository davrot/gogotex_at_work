Title: T052a-followup — Expand latex-editor accessibility tests

Description:
Add further accessibility and keyboard-interaction tests for the LaTeX symbol palette and modal (keyboard navigation, focus management, and aria attributes).

Acceptance criteria:

- Add axe-based accessibility tests covering keyboard navigation between toolbar buttons and palette items.
- Add Playwright tests for keyboard-only flows if a Playwright matrix is available in CI.
- Tests documented in `modz/latex-editor/MOD_INFO.md` with how to enable them locally (e.g., run `npm run test:modz:latex_editor:a11y`).

Owner: TBD
Estimate: 2-3 days
Blocking: Optional: Playwright infra for e2e keyboard test (can be deferred to unit/axe tests).

Suggested labels: T052, P1, accessibility
