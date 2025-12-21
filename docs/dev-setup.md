# Development Setup

This document provides a concise overview for getting the development environment running locally.

## Quick start (minimal)

- Install Node.js (via nvm) and Go (>= 1.25). See sections below for details.
- Start a local MongoDB (via `docker compose` or your preferred method).
- Build and run `webprofile-api` shim for contract/consistency checks: see **Spec Kit** later in this doc.

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

- Go (required for git-bridge now):

Install Go 1.25+ on Linux or macOS. The `git-bridge` service now uses a Go implementation; please prefer Go 1.25+ for local development.

Debian/Ubuntu (apt example):

Option A — Install Go via apt (example):

```bash
sudo apt-get update
sudo apt-get install -y golang-go
```

If you cannot (or prefer not to) install Go locally, you can use the Docker-backed Makefile targets provided in `services/git-bridge`:

- Build with Docker: `make docker-go-build` (uses `golang:1.25` by default)
- Run tests with Docker: `make docker-go-test`

> **Note**: The legacy Java/Maven instructions have been deprecated and removed from the primary workflows. If you require Java-based builds, use an archived branch or request a temporary re-enable.

Option A — Amazon Corretto 21 (apt):

```bash
# Add Corretto apt repo (follow vendor instructions if keys change)
sudo curl -fsSL https://apt.corretto.aws/corretto.key | sudo apt-key add -
echo "deb https://apt.corretto.aws stable main" | sudo tee /etc/apt/sources.list.d/corretto.list
sudo apt-get update
sudo apt-get install -y golang-go
```

Option B — Temurin 21 (if available for your distro):

```bash
# Example (may vary by distro):
sudo apt-get update
sudo apt-get install -y temurin-21-jdk maven
```

Option C — tarball install (fallback):

```bash
# download and extract to /usr/lib/jvm
curl -fsSL -o /tmp/corretto21.tar.gz "https://corretto.aws/downloads/latest/amazon-corretto-21-x64-linux-jdk.tar.gz"
sudo mkdir -p /usr/lib/jvm
sudo tar -xzf /tmp/corretto21.tar.gz -C /usr/lib/jvm
# register the new java as an alternative (example)
sudo update-alternatives --install /usr/bin/java java /usr/lib/jvm/amazon-corretto-21*/bin/java 2000
sudo update-alternatives --set java /usr/lib/jvm/amazon-corretto-21*/bin/java
```

macOS (Homebrew):

```bash
brew update
brew install golang
# follow any post-install instructions to set GOPATH/GOROOT if shown
```

Verify the installations:

```bash
java -version   # should show OpenJDK 21 or newer
mvn -v          # should show Maven 3.8.x or newer
```

If you install Java via a package manager, ensure `JAVA_HOME` is set for builds that require it (example for Linux):

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-amazon-corretto
```

If your environment uses the VS Code dev container, install Java/Maven on the host (recommended) or in the dev container if you prefer local dev installs.

Running Maven tests without host JDK 21:

If you cannot (or prefer not to) install Go on your host, you can use the Docker-backed make targets which run Go inside a container (see above), or use the `golang:1.25` container directly for temporary builds/tests:

```bash
docker run --rm -v /absolute/path/to/services/git-bridge:/app -w /app golang:1.25 sh -c "go test ./... -v"
```

This is a convenient fallback for CI-like test runs or temporary verification.

### Running integration (E2E) tests locally

Integration and end-to-end tests were previously implemented in Java/Maven. For the Go migration, prefer running the Go-based integration tests and the contract tests against the Go shim. If you need to run the archived Java integration tests, run them from the archived branch or re-enable the legacy job temporarily via the `LEGACY_JAVA_RUN` toggle in CI.

For Go-based tests run locally:

```bash
cd services/git-bridge
make go-test
# or (Docker-backed)
make docker-go-test
```

## Build & Start Services

From the `develop` directory, build and start services:

```bash
cd develop
bin/build
bin/up
```

**Host vs Container networking note:**

- If you run commands from your **host shell**, `localhost` / `127.0.0.1` refers to services published to the host (for example the Mongo port `127.0.0.1:27017` is accessible from the host). Use `http://localhost:3900` to reach a shim you started on the host.
- If you run commands from **inside the VS Code dev container** or another container, `localhost` refers to _that container_ and will NOT reach other services. In that case use compose service hostnames on the develop network (for example `http://develop-web-1:3000` or `http://webprofile-api-ci:3900`).

If you only need to build or run the `git-bridge` service during development or for contract tests, you can build/start it individually. `git-bridge` is implemented in **Go**; use the Go build or the provided Docker-backed Makefile targets. If you need the legacy Java/Maven build, it is archived — check out the `archive/java-git-bridge` branch or contact the maintainers for a temporary re-enable.

```bash
# Build just the git-bridge image using the develop compose setup
cd develop
# Option A: use the project directory to avoid host-PWD mount issues
docker compose --project-directory /absolute/path/to/repo/develop build git-bridge
docker compose --project-directory /absolute/path/to/repo/develop up -d git-bridge

# Option B: build the jar locally (requires host JDK 21 + Maven)
cd /absolute/path/to/repo/services/git-bridge
mvn package
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

## SSH key parity checks (Node vs Go) 🔁

We run a non-blocking parity check in CI that compares the Node `web` and the Go `webprofile-api` shim for the SSH key endpoints. This job is currently allowed to fail until parity is fully stable.

To run the parity check locally, ensure `web` (Node) is reachable (for example `http://develop-web-1:3000`) and the Go shim is running locally on `:3900` (or pass a custom `GO_BASE`). Then run:

````bash
scripts/contract/compare_ssh_parity.sh http://develop-web-1:3000 http://webprofile-api-ci:3900 my-compare-user

# If you want to target a shim running on the host (not in the compose network), pass `http://localhost:3900` explicitly as the GO_BASE parameter.

Helper: to start the Go shim attached to the local `develop_default` compose network run:

```bash
# builds image and attaches container to the develop network (publish port 3900 to host)
./scripts/contract/run_webprofile_in_network.sh
# Then from your dev container or other containers on the develop_default network use:
#   http://webprofile-api-ci:3900
# If you need to reach the shim from your host machine you may use http://localhost:3900
````

**Spec Kit:** For a provider-agnostic runbook (build shim, run contract tests, run integration script), see **`.specify/features/example/ci.md`**.

**Run membership contract test locally (example):**

```bash
# Start a local shim (see 'Build & Run webprofile-api (local)' in the Spec Kit)
export TARGET_BASE_URL=http://localhost:3900
cd services/git-bridge/test/contract
TARGET_BASE_URL=${TARGET_BASE_URL} go test -run TestMembershipEndpointNonMemberForbidden ./... -v
```

### Token introspection integration test

The introspection integration test requires a reachable MongoDB (`MONGO_URI`) and a running `webprofile-api` instance (default `http://localhost:3900`). You can set the `MONGO_URI` and `TARGET_BASE_URL` env vars when running the test:

```bash
# example (assumes a local mongodb on 27017 and shim on :3900)
export MONGO_URI=mongodb://localhost:27017
export TARGET_BASE_URL=http://localhost:3900
cd services/git-bridge/test/contract
MONGO_URI=${MONGO_URI} TARGET_BASE_URL=${TARGET_BASE_URL} go test -run TestIntrospectIntegration_Bcrypt -v
```

### Use Go shim for token operations (optional)

You can configure `web` to delegate token introspection and token management to the Go `webprofile-api` by setting:

```bash
# point to the Go shim base URL
export AUTH_LOCAL_INTROSPECT_URL=http://localhost:3900
# enable delegation
export AUTH_TOKEN_USE_WEBPROFILE_API=true

# Running the WebProfile (Go shim) locally
# - Build and run the shim locally with Go 1.25+ and point it at the same Mongo instance used by your `develop` compose network:
#   go build -o /tmp/webprofile-api ./services/git-bridge/cmd/webprofile-api && MONGO_URI="mongodb://mongo:27017/sharelatex" /tmp/webprofile-api &
# - Or use the helper that attaches the shim to your `develop` compose network:
#   ./scripts/contract/run_webprofile_in_network.sh webprofile-api-local
# - In CI the `contract-tests-gating` workflow writes an `.env.ci` file and passes it to `docker compose` so the web service will get:
#   AUTH_TOKEN_USE_WEBPROFILE_API=true
#   AUTH_LOCAL_INTROSPECT_URL=http://webprofile-api-ci:3900
#   WEBPROFILE_ADMIN_USER=overleaf
#   WEBPROFILE_ADMIN_PASS=overleaf
# - To run local parity checks against a running `develop` stack (or the shim started above):
#   AUTH_TOKEN_ALLOW_BCRYPT_FALLBACK=true ./scripts/contract/compare_tokens_parity.sh http://develop-web-1:3000 http://localhost:3900 <user>
# - For debugging, the `scripts/contract` directory contains helper scripts to start the shim and compare introspect/token parity.

```

When enabled, `web` will call the Go shim for `introspect` and token create/list/revoke; this helps test parity and enables a phased cutover (the legacy Node manager is used as a fallback if the Go shim is unavailable).

````

If the Node web instance requires authentication for POSTs, the script will seed keys directly into MongoDB (using `services/web/tools/seed_ssh_key.mjs`) and compare GET responses instead.

Note: when a `develop` compose stack is running, the parity script prefers to run the seeder inside the running `web` container so the seeder runs on the compose network and can reach Mongo via the service hostname (avoids `127.0.0.1`/`localhost` pitfalls). Example:

```bash
# From the repository root (when the develop stack is up):
# copies the public key into the `web` container and runs the seeder there
docker compose -f develop/docker-compose.yml exec -T web sh -lc "cat > /tmp/seed_pub && MONGO_URI='mongodb://mongo:27017/sharelatex' node tools/seed_ssh_key.mjs \"<userId>\" /tmp/seed_pub && rm -f /tmp/seed_pub" < /path/to/testkey.pub
```

If compose is not available the script falls back to running the seeder in a dockerized node container or via the local `node` binary.

CI behaviour: The `ssh_keys_parity_check` job will try to start the Go shim automatically in one of three ways (in order):

- If `go` is installed in the runner, it builds and runs the binary locally.
- Else if `docker` is available, it builds a `webprofile-api` image from `services/git-bridge/cmd/webprofile-api` and runs it as a container (port 3900 exposed).
- Otherwise it expects a reachable `GO_BASE` endpoint and logs a warning if it cannot start the shim.

The job waits for the shim to be responsive and runs `scripts/contract/compare_ssh_parity.sh`. The job uploads the parity outputs to `tmp/parity_results/` as job artifacts (available in the job UI) for debugging failures.

We also include a scheduled (`ssh_keys_parity_nightly`) runner that re-runs the parity comparison multiple times (default 5 runs) to detect flakiness over time; its artifacts are also uploaded to `tmp/parity_results/`.

When parity is stable and you want the CI to block on parity divergence, create the repository toggle file `ci/PARITY_STRICT` with content `true` and merge it to the default branch. The `ssh_keys_parity_check` job inspects `ci/PARITY_STRICT` at runtime; when present and set to `true` parity failures will fail the pipeline. Otherwise parity failures are recorded but non-blocking.

Before enabling strict mode, run the **Validation** job (`ssh_keys_parity_validation`) manually from the Pipelines page (it performs multiple consecutive parity runs and will fail if any mismatch occurs). If the validation job succeeds reliably (e.g., 10 runs pass), add `ci/PARITY_STRICT` (content `true`) via PR and merge it to make parity mismatches block merges. Artifacts from validation runs are saved to `tmp/parity_results/` to aid debugging.

## MongoDB initialization

The development compose setup provides a MongoDB service (`mongo`) configured to run as a replica set named `overleaf` and mounts an initialization script at `/docker-entrypoint-initdb.d/mongodb-init-replica-set.js`. Follow these steps to ensure the replica set is initialized and reachable:

1. Start the `mongo` container (it is started automatically by `bin/up`):

```bash
# start mongo (and other services) in the background
cd develop
bin/up
# or start only mongo
docker compose -f develop/docker-compose.yml up -d mongo
````

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

## First SSH acceptance check

A helper script automates the first-stage SSH acceptance check (dev-only). It:

- Starts `mongo`, `web`, and `git-bridge` via the develop compose file
- Generates a temporary SSH keypair
- Seeds the public key into Mongo for a supplied `userId`
- Verifies `git-bridge` can lookup the fingerprint via the web-profile API

Run it like:

```bash
scripts/e2e/first-ssh-acceptance.sh [userId]
```

It prints the generated key location and fingerprint so you can attempt a manual SSH connection with the private key afterwards.

For full git-over-SSH acceptance against a local `git-bridge` instance (when `sshEnabled` is configured), use `scripts/e2e/git-ssh-acceptance.sh` to seed a key and attempt a remote `git ls-remote` over SSH.

## Webpack Dev Server Ports

**⚠️ IMPORTANT: Do NOT use `127.0.0.1` or `localhost` for service addresses in the dev environment or when running E2E/Playwright tests.** Using `127.0.0.1` or `localhost` from inside dev containers or test runners is blocked and will cause failing or flaky tests and confusing debugging. Always use the compose service hostname and port visible on the development network (for example `http://develop-webpack-1:3808`) or configure a proper reverse proxy, as shown below.

The webpack dev server runs inside a container and is commonly exposed on port `3808` and is reachable on the compose network as `http://develop-webpack-1:3808`. If you relied on port `80` previously, use `http://develop-webpack-1:3808` instead or set up a local reverse-proxy forwarding `:80` to `:3808`.

Note: HTTPS termination for services (including `git-bridge` in production) is handled by the common nginx proxy / load balancer. Individual services typically listen on HTTP and rely on the proxy for TLS; for local development this is often emulated by exposing service ports directly or by configuring a local reverse-proxy.

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
