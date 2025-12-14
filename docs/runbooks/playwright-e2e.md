# Playwright E2E Setup

Quick setup to run Playwright end-to-end tests locally against the `web` service.

1. Start the development services (see `develop/README.md`):

```bash
cd develop
bin/up
# or for development mode
bin/dev web webpack
```

2. Install Playwright and browser + OS deps:

```bash
cd services/web
npm i -D playwright
npx playwright install
npx playwright install-deps
```

3. Run the baseline script (example using port 80):

```bash
BASE_URL=http://127.0.0.1:80 CREATE_TEST_USER=true npm run e2e:playwright
```

Notes

- If your dev environment exposes the webpack server on `:3808`, use `BASE_URL=http://localhost:3808`.
- `npx playwright install-deps` requires sudo on some systems; CI images should have these packages installed.
- Screenshots are written to `services/web/test/e2e/playwright/out/`.
