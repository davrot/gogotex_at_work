# Dockerfile template for sandbox-compile-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/sandbox-compile-go

FROM scratch
COPY --from=build /bin/sandbox-compile-go /bin/sandbox-compile-go
ENTRYPOINT ["/bin/sandbox-compile-go"]
