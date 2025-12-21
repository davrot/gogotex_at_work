# git-bridge Makefile — Java/Maven targets removed

# NOTE: The legacy Java/Maven build and test targets have been removed as part
# of the Go migration. Use the Go targets below (go-build, go-test, etc.) or the
# Docker-backed Go targets (docker-go-build, docker-go-test) to build and test
# the service. If you need to run Java builds temporarily, re-enable them via
# a separate revertible PR.

export BUILD_NUMBER ?= local
export BRANCH_NAME ?= $(shell git rev-parse --abbrev-ref HEAD)
BRANCH_NAME_TAG_SAFE = $(shell echo $(BRANCH_NAME) | sed 's/\//\-\-/g')
export COMMIT_SHA ?= $(shell git rev-parse HEAD)
PROJECT_NAME = git-bridge

IMAGE_CI ?= ci/$(PROJECT_NAME):$(BRANCH_NAME_TAG_SAFE)-$(BUILD_NUMBER)
IMAGE_REPO ?= us-east1-docker.pkg.dev/overleaf-ops/ol-docker/$(PROJECT_NAME)
IMAGE_REPO_BRANCH ?= $(IMAGE_REPO):$(BRANCH_NAME_TAG_SAFE)
IMAGE_REPO_MAIN ?= $(IMAGE_REPO):main
IMAGE_REPO_FINAL ?= $(IMAGE_REPO_BRANCH)-$(BUILD_NUMBER)

runtime-conf:
	/opt/envsubst < conf/envsubst_template.json > conf/runtime.json

# --- Go build/test targets (primary) ---
GO ?= go
GOBIN ?= $(PWD)/bin

go-mod-tidy:
	$(GO) mod tidy

check-go:
	@command -v $(GO) >/dev/null || (echo "go not found; please install Go 1.25+" && exit 1)

go-build: check-go
	$(GO) build -o $(GOBIN)/git-bridge ./cmd/gitbridge

go-test: check-go
	$(GO) test ./... -v

go-bench: check-go
	$(GO) test -bench=. ./... -run=^$

# Docker-backed Go targets (useful if you don't have Go locally installed)
DOCKER_GO_IMAGE ?= golang:1.25

docker-go-build:
	docker run --rm -v $(PWD):/app -w /app/services/git-bridge $(DOCKER_GO_IMAGE) sh -c "go build -o ./bin/git-bridge ./cmd/gitbridge"

docker-go-test:
	docker run --rm -v $(PWD):/app -w /app/services/git-bridge $(DOCKER_GO_IMAGE) sh -c "go test ./... -v"

docker-go-bench:
	docker run --rm -v $(PWD):/app -w /app/services/git-bridge $(DOCKER_GO_IMAGE) sh -c "go test -bench=. ./... -run=^$"

package: go-build
	@echo "Packaging via Go build (use 'make go-build'). Legacy Maven packaging removed."

refresh_cache: refresh_cache_branch
refresh_cache_branch:
	docker inspect $(IMAGE_REPO_BRANCH) > /dev/null && docker pull $(IMAGE_REPO_BRANCH) || true
refresh_cache: refresh_cache_latest
refresh_cache_latest:
	docker inspect $(IMAGE_REPO_MAIN) > /dev/null && docker pull $(IMAGE_REPO_MAIN) || true

push:
	docker push $(IMAGE_REPO_FINAL)

push_branch:
	docker push $(IMAGE_REPO_BRANCH)

clean_ci:
	-docker rmi -f $(IMAGE_CI) $(IMAGE_REPO_FINAL)
	-git clean -xdf .

.PHONY: run package build clean test runtime-conf go-build go-test go-bench go-mod-tidy docker-go-build docker-go-test docker-go-bench
