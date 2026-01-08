# Dockerfile template for docstore-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/docstore-go

FROM scratch
COPY --from=build /bin/docstore-go /bin/docstore-go
ENTRYPOINT ["/bin/docstore-go"]
