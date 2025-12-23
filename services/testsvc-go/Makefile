.PHONY: all build test lint docker integration integration-remote
all: build

build:
	go build ./...

test:
	go test ./... -v

lint:
	golangci-lint run || true

docker:
	docker build -t testsvc-go:local .

integration:
	bash test/integration/run_integration.sh

integration-remote:
	bash test/integration/run_integration.sh --remote-db-test
