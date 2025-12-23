MODULE_NAME=github.com/overleaf/contacts-go

.PHONY: all build test lint docker
all: build

build:
	go build ./...

test:
	go test ./... -v

lint:
	golangci-lint run || true

docker:
	docker build -t contacts-go:local .
