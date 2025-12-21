# Build small Go-based git-bridge image
FROM golang:1.25 as builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /git-bridge ./cmd/gitbridge

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /git-bridge /git-bridge
# Expose SSH port
EXPOSE 22
USER nonroot
ENTRYPOINT ["/git-bridge"]
