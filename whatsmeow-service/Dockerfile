# Multi-stage build for WhatsMeow microservice
# Produces a ~20MB static binary vs ~200MB Node.js

FROM golang:alpine AS builder

WORKDIR /app

# Download dependencies first (cache layer)
COPY go.mod go.sum ./
RUN go mod download

# Build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# Final minimal image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /server /server

EXPOSE 3001

CMD ["/server"]
