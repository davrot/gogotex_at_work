# Dockerfile template for project-history-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/project-history-go

FROM scratch
COPY --from=build /bin/project-history-go /bin/project-history-go
ENTRYPOINT ["/bin/project-history-go"]
