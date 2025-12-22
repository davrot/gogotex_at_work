# Spec Kit: Contract & Integration Test Runbook (webprofile-api)

## Purpose

This document describes how to run the membership contract test and the `webprofile-api` integration check locally or in CI in a provider-agnostic way (the Spec Kit). Do not hard-code provider-specific CI jobs in feature docs — instead document the required steps, runner requirements, and example snippets so maintainers can adapt them to their CI provider (e.g., GitHub Actions).

## Host vs Container networking note

- If you run commands from the **host**, `localhost` / `127.0.0.1` refers to services published to the host (for example a locally started `webprofile-api` on `http://localhost:3900`).
- If you run commands from **inside a dev container** or another container, `localhost` refers to that container and will not reach other services. Use compose service hostnames on the `develop` network instead (for example `http://develop-web-1:3000` or `http://webprofile-api-ci:3900`).

## Runner Requirements

- A runner/host with:
  - `go` (>= 1.25) installed
  - network access to the MongoDB instance used for tests (or a running `mongo` service)
  - `curl` available
- Optional: Docker is useful for starting a local `mongo` if a service is not available.

## Build & Run webprofile-api (local)

1. From repo root, build the shim:

   ```sh
   cd services/git-bridge/cmd/webprofile-api
   go build -o /tmp/webprofile-api .
   /tmp/webprofile-api & echo $! >/tmp/webprofile-api.pid
   ```

2. Wait for the shim to become responsive (example probe):

   ```sh
   for i in {1..15}; do
     code=$(curl -sS -o /dev/null -w "%{http_code}" "http://localhost:3900/internal/api/users/parity-user/ssh-keys" || true)
     if [ -n "$code" ]; then
       echo "webprofile-api responded with HTTP code $code"
       break
     fi
     sleep 1
   done
   ```

3. When finished, stop the shim:

   ```sh
   if [ -f /tmp/webprofile-api.pid ]; then kill $(cat /tmp/webprofile-api.pid) || true; fi
   ```

## Running contract tests (local)

- The contract tests are in `services/git-bridge/test/contract`. To run them against a running `webprofile-api` shim:

  ```sh
  export TARGET_BASE_URL=http://localhost:3900
  cd services/git-bridge/test/contract
  TARGET_BASE_URL=${TARGET_BASE_URL} go test ./... -v
  ```

- The `membership_contract_test.go` intentionally skips if the shim is not running; this keeps local workflows flexible.

## Integration test script

- The integration test script `services/git-bridge/cmd/webprofile-api/integration_test.sh` performs parity-like assertions (unauthenticated requests redirect; authenticated requests succeed). To run it locally:

  ```sh
  chmod +x services/git-bridge/cmd/webprofile-api/integration_test.sh
  services/git-bridge/cmd/webprofile-api/integration_test.sh
  ```

- The script starts a local shim when required and validates expected HTTP codes. It is intended for developer verification and for running in CI jobs that can start the shim.

## CI job guidance (provider-agnostic)

- A Spec Kit CI job implementing these checks should:
  - Ensure the runner has `go` and network access to a MongoDB instance (or start a `mongo` Docker service).
  - Build and start the `webprofile-api` shim on a known port (3900), wait up to 15s for responsiveness.
  - Run `go test` in `services/git-bridge/test/contract` with `TARGET_BASE_URL` set to the shim URL.
  - Run `integration_test.sh` and fail the job on non-zero exit.
  - Publish any test artifacts (logs, parity outputs) to the pipeline artifacts store.

## Running GitHub Actions locally (required for some environments)

Sometimes maintainers cannot or prefer not to run workflows in cloud CI (no credits, restricted runners). This project requires being able to run certain GitHub Actions workflows locally; the steps below document a supported, reproducible approach.

Important notes:

- GitHub Actions in the cloud may use custom hosted runners and services; when running locally you should ensure a compatible environment (Docker, `act` limitations, and required service availability) is used.
- The Spec Kit mandates that the most important gating workflows (for example `integration-web-mongo.yml`) be runnable locally using the documented method.

1. Install `act` (nektos/act) locally in your dev environment or devcontainer. The devcontainer setup script installs `act` optionally. Confirm with:

```sh
act --version
```

2. Prepare secrets and environment variables used by the workflow. Create a `.secrets` file in the repo root (always keep it local and do not commit):

```ini
# .secrets (local only)
MONGO_URI=mongodb://develop-mongo-1:27017
AUTO_MERGE_TOKEN=placeholder_for_local_testing
# add any other secrets referenced by workflows
```

3. Ensure Docker Compose services used by the workflow are running and on a known network (the default `develop_default` works for the project). For example:

```sh
# start required services: mongo and any others the workflow depends on
cd develop && bin/up && cd -
```

4. Use `act` to run the workflow or a specific job. Example (runs the `web-mongo-integration` job in `integration-web-mongo.yml`):

```sh
# Run the specific job interactively with secrets loaded
act -j "web-mongo-integration" -s MONGO_URI="mongodb://develop-mongo-1:27017" -s AUTO_MERGE_TOKEN=mytoken
```

If your local `act` environment lacks the exact runner image used in cloud (Ubuntu), prefer the `-P` mapping to provide an image for `ubuntu-latest`:

```sh
act -P ubuntu-latest=nektos/act-environments-ubuntu:18.04 -j "web-mongo-integration" -s MONGO_URI="mongodb://develop-mongo-1:27017"
```

5. Use the helper script (recommended): `scripts/ci/run-actions-locally.sh` — this script loads `.secrets`, ensures compose services are up, and calls `act` with the appropriate job name and runner image mapping. See the script for usage examples.

Caveats & limitations

- `act` does not perfectly emulate GitHub-hosted runners (some actions or features may behave differently). Use it for reproducible, local gating, but validate in your target CI provider before flipping strict gates.
- When workflows rely on resource profiles to measure benchmarks, consider using Docker images to emulate the runner profile or run benchmarks inside a container with resource limits to approximate the CI runner.

Addendum

- Make it a policy that any future gating workflow that is considered "required to be runnable locally" MUST include a concise act-compatible invocation snippet in its Spec Kit section. This project requires that the integration and parity gating jobs be runnable locally by maintainers.

## Example (pseudo-job steps)

- Build shim
- Start shim
- Wait for shim
- Run contract tests
- Run integration script
- Tear down shim

## Notes

- This Spec Kit doc intentionally avoids prescribing a provider-specific job; project maintainers should adapt the steps to their CI provider (e.g., GitHub Actions) and runner pool.
- For reproducible benchmarking, maintain the runner profile guidance in `spec.md` (2 vCPU, 4GB RAM) and document how to assert runner equivalence in your CI provider.

## Docker Compose example (provider-neutral)

If you prefer to run the shim and Mongo locally in a reproducible way, a Docker Compose setup is convenient and provider-agnostic. The following `docker-compose.yml` is a minimal example that builds the `webprofile-api` from the repo and starts a local `mongo` instance.

```yaml
version: "3.8"
services:
  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  webprofile-api:
    build:
      context: ./services/git-bridge/cmd/webprofile-api
      dockerfile: Dockerfile
    ports:
      - "3900:3900"
    environment:
      - MONGO_URI=mongodb://mongo:27017/sharelatex
    depends_on:
      - mongo

volumes:
  mongo-data:
```

Usage steps:

1. From repository root, start the stack:

```sh
docker compose -f docker-compose.ci.yml up --build -d
```

2. Wait for the shim to become responsive (same probe as above):

```sh
for i in {1..15}; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "http://localhost:3900/internal/api/users/parity-user/ssh-keys" || true)
  if [ -n "$code" ]; then
    echo "webprofile-api responded with HTTP code $code"
    break
  fi
  sleep 1
done
```

3. Run contract tests against the local shim:

```sh
export TARGET_BASE_URL=http://localhost:3900
cd services/git-bridge/test/contract
TARGET_BASE_URL=${TARGET_BASE_URL} go test ./... -v
```

4. Run the integration script (it will also start a local shim if required, so either run after building or directly if you prefer):

```sh
chmod +x services/git-bridge/cmd/webprofile-api/integration_test.sh
services/git-bridge/cmd/webprofile-api/integration_test.sh
```

5. Tear down when done:

```sh
docker compose -f docker-compose.ci.yml down -v
```

This Compose example is intentionally small — adapt resource limits, network adapters, or add a seed/init container that populates Mongo (for deterministic seed data) as your CI or local workflows require.

---

Documented by: Spec Kit (feature: SSH + HTTPS Git Auth)
