# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /build/server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /build/seed ./cmd/seed

# Runtime stage
FROM alpine:3.21
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /build/server .
COPY --from=builder /build/seed .
EXPOSE 8080
CMD ["./server"]
