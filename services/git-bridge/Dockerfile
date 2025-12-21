# Minimal Go-based Dockerfile for git-bridge

FROM golang:1.25 AS builder
WORKDIR /build

# Build helper envsubst binary (used to render config templates)
RUN go install github.com/a8m/envsubst/cmd/envsubst@latest

# Build the Go binary
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /git-bridge ./cmd/gitbridge

FROM gcr.io/distroless/static:nonroot

# Copy the built binary
COPY --from=builder /git-bridge /git-bridge
COPY --from=builder /go/bin/envsubst /opt/envsubst
RUN chmod +x /opt/envsubst || true

# Expose SSH port
EXPOSE 22

# Copy config template and start scripts
COPY conf/envsubst_template.json /envsubst_template.json
COPY start.sh /start.sh
COPY server-pro-start.sh /server-pro-start.sh
RUN mkdir /conf && chmod 0755 /conf

USER nonroot

# start.sh chooses Go binary when present
ENTRYPOINT ["/start.sh"]
