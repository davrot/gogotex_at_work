# Dockerfile template for chat-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/chat-go

FROM scratch
COPY --from=build /bin/chat-go /bin/chat-go
ENTRYPOINT ["/bin/chat-go"]
