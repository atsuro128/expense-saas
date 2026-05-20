# Frontend build stage
# Vite build 成果物を生成する。layer cache を効かせるため package*.json を先にコピーする。
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Backend build stage
# Go バイナリをビルドする。frontend/dist を embed するため frontend-builder の成果物をコピーする。
FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# frontend/dist を cmd/server/ 配下に配置する。
# //go:embed のパターンは ".." を使用不可のため、embed.go（cmd/server/embed.go）のディレクトリを
# 起点に "frontend/dist" として参照できるよう cmd/server/frontend/dist にコピーする。
COPY --from=frontend-builder /build/frontend/dist ./cmd/server/frontend/dist
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
