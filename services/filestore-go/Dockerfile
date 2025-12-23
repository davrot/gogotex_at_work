# Dockerfile template for filestore-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/filestore-go

FROM scratch
COPY --from=build /bin/filestore-go /bin/filestore-go
ENTRYPOINT ["/bin/filestore-go"]
