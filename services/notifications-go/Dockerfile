# Dockerfile template for notifications-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/notifications-go

FROM scratch
COPY --from=build /bin/notifications-go /bin/notifications-go
ENTRYPOINT ["/bin/notifications-go"]
