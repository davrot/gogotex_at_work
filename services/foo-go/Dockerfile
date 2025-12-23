# Dockerfile template for foo-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/foo-go

FROM scratch
COPY --from=build /bin/foo-go /bin/foo-go
ENTRYPOINT ["/bin/foo-go"]
