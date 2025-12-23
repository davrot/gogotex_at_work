# Contract scripts (webprofile parity)

This directory contains helper scripts used to run contract/parity checks between the Node `web` service and the Go `webprofile-api` shim.

Main helpers

- `run_webprofile_in_network.sh [image_tag]` — builds the `webprofile-api` image and runs it attached to a specified Docker network (default `develop_default`). Useful to start the shim inside a compose network so other services can call `http://<image_tag>:3900`.

- `compare_introspect.sh NODE_BASE GO_BASE` — compares token introspect responses between Node and Go.

Local usage examples

1. Start an isolated network and a Mongo container:

```bash
docker network create webprofile-parity-net || true
docker run -d --name webprofile-parity-mongo --network webprofile-parity-net mongo:6.0.5
```

2. Start the webprofile API in that network:

```bash
NETWORK=webprofile-parity-net MONGO_URI="mongodb://webprofile-parity-mongo:27017/sharelatex" ./scripts/contract/run_webprofile_in_network.sh webprofile-api-parity
```

3. Run the Go integration test against the running shim:

```bash
cd services/git-bridge
TARGET_BASE_URL=http://webprofile-api-parity:3900 MONGO_URI=mongodb://webprofile-parity-mongo:27017 go test ./test/contract -run TestTokenCreateIntrospectRevokeIntegration -v
```

4. Run a Node parity smoke test (optional)

```bash
# This is a lightweight Node-based smoke that does not require installing project deps.
# It is also used by the CI job and local helper.
TARGET_BASE_URL=http://webprofile-api-parity:3900 docker run --rm --network webprofile-parity-net -e TARGET_BASE_URL=http://webprofile-api-parity:3900 node:18 \
  node -e "(async () => { const base = process.env.TARGET_BASE_URL; const auth = 'Basic ' + Buffer.from('overleaf:overleaf').toString('base64'); const headers = { 'Authorization': auth, 'Content-Type': 'application/json' }; const userId = 'parity-node-' + Date.now(); const createRes = await fetch(base + '/internal/api/users/' + userId + '/git-tokens', { method: 'POST', headers, body: JSON.stringify({ label: 'parity-test', scopes: ['repo:read'] }) }); console.log('create status', createRes.status); const createBody = await createRes.json(); console.log(createBody); })()"
```

Cleanup:

```bash
docker rm -f webprofile-api-parity >/dev/null 2>&1 || true
docker rm -f webprofile-parity-mongo >/dev/null 2>&1 || true
docker network rm webprofile-parity-net >/dev/null 2>&1 || true
```

Run the full parity helper (recommended)

```bash
# run both Go and Node parity checks with built-in timeouts and artifact collection
./scripts/contract/run_parity_locally.sh

# common flags:
# --no-cleanup  => leave containers + network running for inspection
# --keep-network => do not remove the docker network during cleanup
# PUBLISH_PORT=true ./scripts/contract/run_parity_locally.sh => publish host port 3900 (if you need host access)
```

Scheduled CI runs

- The parity job runs on PRs and also on a daily schedule (03:00 UTC) via `.github/workflows/webprofile-parity.yml`.
- Artifacts produced by CI are bundled as `webprofile-parity.tar.gz` and uploaded for triage.

Notes

- The helper uses `timeout` for both the Go parity run (120s) and Node parity smoke (180s) to avoid blocking developers and CI on hangs.
- If Docker on your host disallows bind mounts to the container running the helper (for example when running inside restricted dev containers), the helper will still start networks and containers where possible but may not be able to mount the repo for in-container test execution; in that case run the parity steps directly on the host.

Notes

- CI already includes a non-blocking parity job (`.github/workflows/webprofile-parity.yml`) that performs these steps on PRs; the job is allowed to fail while parity is stabilised.
- If you prefer running a shim on your host, use `./scripts/dev/run_webprofile_local.sh` to build and run an image locally (attached to host network / published port).
