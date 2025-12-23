# Dockerfile template for ci-autogen-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/ci-autogen-go

FROM scratch
COPY --from=build /bin/ci-autogen-go /bin/ci-autogen-go
ENTRYPOINT ["/bin/ci-autogen-go"]
