Playwright e2e baseline

This is a simple baseline script that exercises the user creation and login flow and takes screenshots.

Prerequisites

- Install Playwright and browser dependencies (run from project root):

```bash
cd services/web
npm i -D playwright
npx playwright install
npx playwright install-deps
```

- If you need help starting the dev services see `develop/README.md` for the local dev setup and `http://localhost/launchpad` to create the first admin account.

Run

```bash
# from repo root
BASE_URL=http://127.0.0.1:13000 npm run e2e:playwright
```

Pre-run reminder

- The `e2e:playwright` invocation now runs a pre-run check that prints a reminder to re-read `docs/dev-setup.md` and will prompt interactively for confirmation unless `CONFIRM_DEV_SETUP=true` or `CI=true` is set in the environment.
- To run non-interactively (for CI or scripted runs) set `CONFIRM_DEV_SETUP=true` in the environment to bypass the prompt.
  Screenshots will be written to `services/web/test/e2e/playwright/out/`:

- `user_created.png`
- `login_success.png`
- `user_settings.png`
