MODULE_NAME=github.com/overleaf/contacts-go

.PHONY: all build test lint docker
all: build

build:
	go build ./...

test:
	# Run tests with timeout to prevent hanging
	timeout 30s go test ./... -v

lint:
	golangci-lint run || true

docker:
	docker build -t contacts-go:local .

# Run the integration script (local checks)
integration:
	bash test/integration/run_integration.sh

# Run integration including the optional networked Go DB validation (may be slow)
integration-remote:
	bash test/integration/run_integration.sh --remote-db-test
