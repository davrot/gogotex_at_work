# Dockerfile template for document-updater-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/document-updater-go

FROM scratch
COPY --from=build /bin/document-updater-go /bin/document-updater-go
ENTRYPOINT ["/bin/document-updater-go"]
