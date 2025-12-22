FROM golang:1.25-alpine AS build
WORKDIR /src
COPY . .
RUN go env && go version && go build -o /bin/webprofile-api ./...

FROM alpine:3.18
RUN apk add --no-cache ca-certificates
COPY --from=build /bin/webprofile-api /bin/webprofile-api
EXPOSE 3900
ENTRYPOINT ["/bin/webprofile-api"]
