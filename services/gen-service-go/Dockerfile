# Dockerfile template for gen-service-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/gen-service-go

FROM scratch
COPY --from=build /bin/gen-service-go /bin/gen-service-go
ENTRYPOINT ["/bin/gen-service-go"]
