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

- If you need help starting the dev services see `develop/README.md` for the local dev setup and `http://develop-webpack-1:3808/launchpad` to create the first admin account.

Run

```bash
# from repo root
BASE_URL=http://develop-webpack-1:3808 npm run e2e:playwright

Note: 127.0.0.1 and localhost are intentionally blocked for e2e tests — point `BASE_URL` at the dev compose webpack host (e.g. `http://develop-webpack-1:3808`).
```

Pre-run reminder

- The `e2e:playwright` invocation now runs a pre-run check that prints a reminder to re-read `docs/dev-setup.md` and will prompt interactively for confirmation unless `CONFIRM_DEV_SETUP=true` or `CI=true` is set in the environment.
- To run non-interactively (for CI or scripted runs) set `CONFIRM_DEV_SETUP=true` in the environment to bypass the prompt.
  Screenshots will be written to `services/web/test/e2e/playwright/out/`:

- `user_created.png`
- `login_success.png`
- `user_settings.png`

Optional environment variables

- `ADD_SSH_KEYS=true` — populate the user settings with example SSH keys (the script already supports this)
- `ADD_TOKEN=true` — create a personal access token via the UI and save it to `out/created_token.txt`
- `CHECK_TOKEN_GIT=true` and `PROJECT_ID=<projectId>` — if set, after creating the token the script will attempt a `git ls-remote` using the token against the given project id and save output to `out/git_ls_remote.txt`
