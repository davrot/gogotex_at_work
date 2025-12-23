# Dockerfile template for testsvc-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/testsvc-go

FROM scratch
COPY --from=build /bin/testsvc-go /bin/testsvc-go
ENTRYPOINT ["/bin/testsvc-go"]
