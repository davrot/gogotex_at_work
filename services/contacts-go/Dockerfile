FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/contacts-go ./

FROM scratch
COPY --from=build /bin/contacts-go /bin/contacts-go
EXPOSE 8080
ENTRYPOINT ["/bin/contacts-go"]
