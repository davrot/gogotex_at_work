# Dockerfile template for git-bridge-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/git-bridge-go

FROM scratch
COPY --from=build /bin/git-bridge-go /bin/git-bridge-go
ENTRYPOINT ["/bin/git-bridge-go"]
