# Build Go binary and produce a lightweight runtime image
FROM golang:1.25 AS builder
WORKDIR /app
COPY . /app
WORKDIR /app
# Build a static Go binary (disable cgo) for maximum compatibility with Alpine
ENV CGO_ENABLED=0
RUN go env && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w" -o /git-bridge ./cmd/gitbridge

FROM alpine:3.18
RUN apk add --no-cache bash gettext ca-certificates
RUN adduser -D node || true
COPY --from=builder /git-bridge /git-bridge
COPY start.sh /start.sh
COPY server-pro-start.sh /server-pro-start.sh
RUN chmod +x /start.sh /server-pro-start.sh /git-bridge
EXPOSE 22 8000
USER node
ENTRYPOINT ["/server-pro-start.sh"]
