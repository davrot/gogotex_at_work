# Development Setup

This document provides a concise overview for getting the development environment running locally.

## Prerequisites

- Install Node.js via `nvm` (recommended):

```bash
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"
# Download and install Node.js:
nvm install 24
# Verify the Node.js version:
node -v # Should print "v24.12.0".
# Verify npm version:
npm -v # Should print "11.6.2".
```

- Playwright (for e2e tests):

```bash
cd services/web
npm i -D playwright
npx playwright install
# install OS-level deps on Linux hosts
npx playwright install-deps
```

- Java & Maven (required by some services/build tasks):

Install OpenJDK 17 (or newer) and Maven 3.8+ on Linux or macOS.

Debian/Ubuntu (apt):

```bash
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk maven
```

macOS (Homebrew):

```bash
brew update
brew install openjdk@17 maven
# follow brew post-install instructions for JAVA_HOME if shown
```

Verify the installations:

```bash
java -version   # should show OpenJDK 17 or newer
mvn -v          # should show Maven 3.8.x or newer
```

If you install Java via a package manager, ensure `JAVA_HOME` is set for builds that require it (example for Linux):

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

If your environment uses the VS Code dev container, install Java/Maven on the host (recommended) or in the dev container if you prefer local dev installs.

## Build & Start Services

From the `develop` directory, build and start services:

```bash
cd develop
bin/build
bin/up
```

### Starting from inside the VS Code dev container

When you run `bin/build`/`bin/up` from inside the project's VS Code dev container, the `${PWD}` value (and the shell's `PWD` environment) is the _guest_ path inside the dev container (for example, `/workspaces/...`), not the absolute host path that Docker will attempt to bind-mount. That mismatch can make compose mount paths point to non-existent host locations and cause the build to fail.

Two safe approaches when running from inside a VS Code dev container:

- Preferred: run the build/start steps from a shell on your host (recommended):

```bash
cd develop
bin/build
bin/up
```

- If you need to run from inside the dev container, explicitly provide the host workspace path (the absolute path on your host machine) instead of relying on `$PWD`:

```bash
# Set HOST_WORKSPACE to the absolute path on the host that corresponds to the repository root.
# Example host path (your host path may differ):
export HOST_WORKSPACE=/data_1/davrot/overleaf_dev/workspace/git-bridge/overleaf_with_admin_extension
# Option A: export PWD to the host path so scripts using ${PWD} pick it up
export PWD="$HOST_WORKSPACE"
export DOCKER_SOCKET_PATH=/var/run/docker.sock
cd develop
bin/build
bin/up

# Option B: bypass PWD and call docker compose with --project-directory directly
# (this avoids changing env vars and works well when `bin/*` are thin wrappers)
cd develop
docker compose --project-directory "$HOST_WORKSPACE" build
docker compose --project-directory "$HOST_WORKSPACE" up
```

### If you're inside a VS Code dev container: network & host addressing

When running inside a VS Code dev container, you may need to connect that container to the Overleaf development Docker network so it can reach other service containers by their compose service names.

```bash
# Connect your VS Code dev container to the Overleaf develop network
# Run on the host (or inside the dev container if Docker is available and $(hostname) resolves to the container name)
docker network connect develop_default $(hostname)
```

Also, from inside the dev container you typically cannot use `http://127.0.0.1:80` to reach the webpack/dev reverse proxy on the host. Instead use the service hostname and port visible on the compose network, for example:

```text
http://develop-web-1:3000
```

If those exact names don't work in your environment, list the containers on the `develop_default` network and check the service container names:

```bash
docker network inspect develop_default --format '{{json .Containers}}' | jq '.'
```

Also note: some compose files use hard-coded absolute host paths (for example, `/data_1/...`). If those exact paths don't exist on your host, update them to match your environment or change them to use the host path variable shown above.

If Docker uses too much RAM when building services in parallel, create `.env` in `develop/` with:

If Docker uses too much RAM when building services in parallel, create `.env` in `develop/` with:

```text
COMPOSE_PARALLEL_LIMIT=1
```

For iterative development you can use the development mode which restarts services on code changes:

```bash
bin/dev
# or start only subset:
bin/dev web webpack
```

Starting the `web` service in development mode will update the backend automatically; to auto-update frontend code also start the `webpack` service.

## MongoDB initialization

The development compose setup provides a MongoDB service (`mongo`) configured to run as a replica set named `overleaf` and mounts an initialization script at `/docker-entrypoint-initdb.d/mongodb-init-replica-set.js`. Follow these steps to ensure the replica set is initialized and reachable:

1. Start the `mongo` container (it is started automatically by `bin/up`):

```bash
# start mongo (and other services) in the background
cd develop
bin/up
# or start only mongo
docker compose -f develop/docker-compose.yml up -d mongo
```

2. Wait for the container to accept connections and for the init script to run. You can follow the logs:

```bash
docker compose -f develop/docker-compose.yml logs -f mongo
```

Look for messages indicating the replica set was initiated or that the server is waiting for connections.

3. Verify replica-set status using `mongosh`:

```bash
# using docker compose exec
docker compose -f develop/docker-compose.yml exec mongo mongosh --eval 'rs.status()'

# or docker exec with a container name
docker exec -it $(docker compose -f develop/docker-compose.yml ps -q mongo) mongosh --eval 'rs.status()'
```

If the replica set is healthy you should see an object with `ok: 1` and `members` listed.

4. If you need to force initialization (for example after removing volumes), run the init script interactively:

```bash
docker compose -f develop/docker-compose.yml exec mongo mongosh /docker-entrypoint-initdb.d/mongodb-init-replica-set.js
```

5. To reset MongoDB state (destructive), bring the compose stack down and remove the volume then bring it up again:

```bash
# stop services and remove volumes (data will be lost)
docker compose -f develop/docker-compose.yml down -v
# start again
docker compose -f develop/docker-compose.yml up -d mongo
```

Notes:

- The `mongo` service exposes port `27017` on the host for debugging (`127.0.0.1:27017` in the compose file). Use `mongodb://localhost:27017` when connecting from your host.
- If the init script doesn't run on first boot, confirm the file is present at `develop/bin/shared/mongodb-init-replica-set.js` and that the compose mount is intact.

## Creating the First Admin

Once services are running, open `http://localhost/launchpad` to create the first admin account. The launchpad page provides forms for creating an initial admin if no admin users exist.

## Webpack Dev Server Ports

The webpack dev server runs inside a container and is commonly exposed on host port `3808` (http://localhost:3808) in the `develop` compose setup. If you relied on port `80` previously, use `http://localhost:3808` instead or set up a local reverse-proxy forwarding `:80` to `:3808`.

When running tests or browsers from _inside_ a VS Code dev container, use the webpack dev server host directly (it serves assets and proxies API calls to the backend):

```bash
# From inside the dev container use the webpack service hostname and port
# (the webpack dev server serves JS/CSS and proxies API requests to the web backend)
BASE_URL=http://develop-webpack-1:3808 npm run e2e:playwright
```

Note: To allow browsers running inside a VS Code dev container (or other containers) to load webpack assets, set the dev server `host` to `0.0.0.0` and `allowedHosts: 'all'` in `develop/webpack.config.dev-env.js`. Example:

```js
// develop/webpack.config.dev-env.js
module.exports = merge(base, {
  devServer: {
    host: "0.0.0.0",
    allowedHosts: "all",
    // ...
  },
});
```

After making this change restart the webpack service (or rebuild the webpack image if you changed Dockerfile-related things):

```bash
# restart the running webpack container
docker compose --project-directory /path/to/repo/develop restart webpack

# or rebuild the webpack image then restart it
cd develop
bin/build webpack
docker compose --project-directory "$PWD" restart webpack
```

For iterative development use the dev script to run webpack in watch mode (recommended):

```bash
# from the develop directory
./bin/dev webpack
```

When running Playwright or browsers from inside the dev container, point `BASE_URL` at the webpack host (it serves JS/CSS and proxies API calls):

```bash
BASE_URL=http://develop-webpack-1:3808 npm run e2e:playwright
```

## Fixing a dev-container build failure for `libraries/eslint-plugin`

Some local builds of the dev containers can fail because `libraries/eslint-plugin` is missing a minimal set of `dependencies`/`devDependencies` needed during install or the container image build. If you encounter errors during `develop/bin/build` that reference `eslint`, `@typescript-eslint`, or `lodash`, adding the following `package.json` to `libraries/eslint-plugin/package.json` resolves the issue:

```json
{
  "name": "@overleaf/eslint-plugin",
  "version": "0.1.0",
  "license": "AGPL-3.0-only",
  "dependencies": {
    "eslint": "^8.51.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@typescript-eslint/parser": "^8.30.1"
  }
}
```

## Notes

- If the full frontend test suite fails locally due to missing generated artifacts (for example, `lezer-latex/latex.mjs`), regenerate them with `cd services/web && npm run lezer-latex:generate`. If you just want an automated fallback that writes minimal stubs, run `cd services/web && npm run lezer-latex:ensure` (this runs automatically before `npm run test:frontend`). For focused tests, you can still use the lightweight bootstrap: `cd services/web && npm run test:frontend:lite -- path/to/test-file.tsx`.
- See `develop/README.md` for more details and runtime tips (TeX Live build, Docker socket, and debugging ports).
- The Playwright e2e runbook is at `docs/runbooks/playwright-e2e.md` for end-to-end test setup and commands.
