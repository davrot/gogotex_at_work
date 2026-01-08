# Dockerfile template for real-time-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/real-time-go

FROM scratch
COPY --from=build /bin/real-time-go /bin/real-time-go
ENTRYPOINT ["/bin/real-time-go"]
