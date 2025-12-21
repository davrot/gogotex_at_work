# writelatex-git-bridge

## Docker

The `Dockerfile` contains all the requirements for building and running the
writelatex-git-bridge.

Note: In production the service is expected to be fronted by the common nginx proxy/load-balancer which handles TLS termination (HTTPS). The `git-bridge` process listens on an internal HTTP port and relies on the proxy for HTTPS exposure; in local dev you may run the service directly and use the develop network or a local reverse-proxy for HTTPS emulation.

```bash
# build the image
docker build -t writelatex-git-bridge .

# run it with the demo config
docker run -v `pwd`/conf/local.json:/conf/runtime.json writelatex-git-bridge
```

## Native install

### Required packages

- `go` 1.25+ (for Go-based development)

> **Note**: The legacy Java/Maven build for `git-bridge` has been deprecated and removed from primary CI. If you need to run old Java tests or builds, you should do so from an archived branch or by reverting the deprecation PR.

### Commands

To be run from the base directory:

**Build Go binary**:
`make go-build`

**Run Go tests**:
`make go-test`

To be run from the dev-environment:

**Build Go binary**:
`bin/run git-bridge make go-build`

**Run Go tests**:
`bin/run git-bridge make go-test`

### Installation

Install Go (for Go-based development):

- Recommended: **Go 1.25.x** (tested with **1.25.5**). If you can, install the latest Go 1.25 patch release.

Native install example (Ubuntu):

```bash
sudo apt-get update
sudo apt-get install -y golang-go
# or download from https://go.dev/dl/ (choose 1.25.x)
```

If you cannot or prefer not to install Go locally, use the Docker-backed make targets provided in the `Makefile`:

- Build with Docker: `make docker-go-build` (uses `golang:1.25` by default)
- Run tests with Docker: `make docker-go-test`
- Run benchmarks with Docker: `make docker-go-bench`

Create a config file according to the format below.

Run `make go-build` to build the Go binary and use the included `start.sh` (it will run the Go binary if present).

## Runtime Configuration

The configuration file is in `.json` format.

    {
        "port" (int): the port number,
        "rootGitDirectory" (string): the directory in which to store
                                     git repos and the db/atts,
        "apiBaseUrl" (string): base url for the snapshot api,
        "username" (string, optional): username for http basic auth,
        "password" (string, optional): password for http basic auth,
        "postbackBaseUrl" (string): the postback url,
        "serviceName" (string): current name of writeLaTeX
                                in case it ever changes,
        "oauth2Server" (string): oauth2 server,
               with protocol and
               without trailing slash,
               null or missing if oauth2 shouldn't be used
        "webProfileApiUrl" (string, optional): internal web-profile API base URL for SSH key retrieval (recommended),
        "webProfileApiToken" (string, optional): bearer token for internal web-profile API calls,
        "sshOnly" (boolean, optional): if true, only SSH-based Git authentication is enabled and legacy HTTP/OAuth2 methods are rejected (default: false),
        },
        "repoStore" (object, optional): { configure the repo store
            "maxFileSize" (long, optional): maximum size of a file, inclusive
        },
        "swapStore" (object, optional): { the place to swap projects to.
                                          if null, type defaults to
                                          "noop"
            "type" (string): "s3", "memory", "noop" (not recommended),
            "awsAccessKey" (string, optional): only for s3,
            "awsSecret" (string, optional): only for s3,
            "s3BucketName" (string, optional): only for s3
        },
        "swapJob" (object, optional): { configure the project
                                        swapping job.
                                        if null, defaults to no-op
            "minProjects" (int64): lower bound on number of projects
                                   present. The swap job will never go
                                   below this, regardless of what the
                                   watermark shows. Regardless, if
                                   minProjects prevents an eviction,
                                   the swap job will WARN,
            "lowGiB" (int32): the low watermark for swapping,
                              i.e. swap until disk usage is below this,
            "highGiB" (int32): the high watermark for swapping,
                               i.e. start swapping when
                               disk usage becomes this,
            "intervalMillis" (int64): amount of time in between running
                                      swap job and checking watermarks.
                                      3600000 is 1 hour
        }
    }

You have to restart the server for configuration changes to take effect.

## Developer quickstart: rebuild & restart

When making changes that affect configuration or embedded services, ensure you rebuild and restart the dev environment before running contract or integration tests:

```bash
cd develop
./bin/build
./bin/up
# or from repo root:
# develop/bin/build && ./bin/up
```

This helps ensure that `envsubst` and compose config changes are applied and containers are restarted with the updated config.

## Creating OAuth app

In dev-env, run the following command in mongo to create the oauth application
for git-bridge.

```
db.oauthApplications.insert({
  "clientSecret" : "v1.G5HHTXfxsJMmfFhSar9QhJLg/u4KpGpYOdPGwoKdZXk=",
  "grants" : [
    "password"
  ],
  "id" : "264c723c925c13590880751f861f13084934030c13b4452901e73bdfab226edc",
  "name" : "Overleaf Git Bridge",
  "redirectUris" : [],
  "scopes" : [
    "git_bridge"
  ]
})
```
