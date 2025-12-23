# Build a Go-based image for the chat service (not enabled by default)

FROM golang:1.25 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
WORKDIR /src/cmd/chat
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o /bin/chat ./...

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /bin/chat /bin/chat
EXPOSE 3011
USER nonroot:nonroot
ENTRYPOINT ["/bin/chat"]
