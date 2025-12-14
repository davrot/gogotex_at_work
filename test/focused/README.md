Focused test suites

- Run only the focused tests (git-bridge + UI):

```bash
npm run test:focused:unit
```

- Playwright E2E (opt-in):

The Playwright e2e flows that exercise SSH keys and tokens are available in `services/web/test/e2e/playwright` and can be included in the focused run by setting `RUN_E2E=true` and providing test credentials/environment variables.

Example (runs unit + e2e):

```bash
RUN_E2E=true BASE_URL=http://127.0.0.1:13000 TEST_USER_EMAIL=test@example.com TEST_USER_PASSWORD=pass npm run test:focused
```

Or run e2e directly:

```bash
npm run test:focused:e2e
```

- Focused suites live under `test/focused` and are designed to mock external infra.
- Add tests that only touch your changed modules (git-bridge, SSH key UI, token logic).
