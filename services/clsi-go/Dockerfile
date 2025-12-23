# Dockerfile template for clsi-go

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/clsi-go

FROM scratch
COPY --from=build /bin/clsi-go /bin/clsi-go
ENTRYPOINT ["/bin/clsi-go"]
