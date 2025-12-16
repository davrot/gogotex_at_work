Focused test suites

- Run only the focused tests (git-bridge + UI):

```bash
npm run test:focused:unit
```

- Playwright E2E (opt-in):

The Playwright e2e flows that exercise SSH keys and tokens are available in `services/web/test/e2e/playwright` and can be included in the focused run by setting `RUN_E2E=true` and providing test credentials/environment variables.

IMPORTANT: Re-read `docs/dev-setup.md` before running Playwright or any e2e tests — it contains the required environment and networking steps (dev containers, BASE_URL and docker networking) needed to run e2e reliably. Skipping that will often cause tests to fail silently or be unable to connect to the dev server.

Example (runs unit + e2e):

```bash
RUN_E2E=true BASE_URL=http://develop-webpack-1:3808 TEST_USER_EMAIL=test@example.com TEST_USER_PASSWORD=pass npm run test:focused

Note: 127.0.0.1 and localhost are blocked for e2e runs; point `BASE_URL` at the webpack dev host on the dev compose network (e.g. http://develop-webpack-1:3808).
```

Or run e2e directly:

```bash
npm run test:focused:e2e
```

- Focused suites live under `test/focused` and are designed to mock external infra.
- Add tests that only touch your changed modules (git-bridge, SSH key UI, token logic).
