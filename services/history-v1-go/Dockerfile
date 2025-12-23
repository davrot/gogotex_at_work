# Dockerfile template for history-v1-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/history-v1-go

FROM scratch
COPY --from=build /bin/history-v1-go /bin/history-v1-go
ENTRYPOINT ["/bin/history-v1-go"]
