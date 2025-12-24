.PHONY: all build test lint docker integration integration-remote
all: build

build:
	go build ./...

test:
	# Run tests with timeout to prevent hanging
	timeout 30s go test ./... -v

lint:
	golangci-lint run || true

docker:
	docker build -t ${NAME}-go:local .

# Integration helpers
integration:
	bash test/integration/run_integration.sh

integration-remote:
	bash test/integration/run_integration.sh --remote-db-test
