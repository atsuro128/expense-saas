package middleware

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const (
	requestIDKey  contextKey = "request_id"
	userIDKey     contextKey = "user_id"
	tenantIDKey   contextKey = "tenant_id"
	roleKey       contextKey = "role"
	connKey       contextKey = "conn"
	requestInfoKey contextKey = "request_info"
)

// RequestInfo is a mutable struct stored in context by Logger, allowing
// downstream middleware (Auth, TenantContext) to propagate user/tenant
// information back to the Logger after ServeHTTP returns.
type RequestInfo struct {
	UserID   string
	TenantID string
	Role     string
}

// GetRequestInfo retrieves the RequestInfo pointer from the context.
// Returns nil when not set.
func GetRequestInfo(ctx context.Context) *RequestInfo {
	info, _ := ctx.Value(requestInfoKey).(*RequestInfo)
	return info
}

// SetRequestID stores the request ID in the context.
func SetRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

// GetRequestID retrieves the request ID from the context.
func GetRequestID(ctx context.Context) string {
	v, _ := ctx.Value(requestIDKey).(string)
	return v
}

// SetUserID stores the user ID in the context.
func SetUserID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, userIDKey, id)
}

// GetUserID retrieves the user ID from the context.
func GetUserID(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}

// SetTenantID stores the tenant ID in the context.
func SetTenantID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, tenantIDKey, id)
}

// GetTenantID retrieves the tenant ID from the context.
func GetTenantID(ctx context.Context) string {
	v, _ := ctx.Value(tenantIDKey).(string)
	return v
}

// SetRole stores the role in the context.
func SetRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, roleKey, role)
}

// GetRole retrieves the role from the context.
func GetRole(ctx context.Context) string {
	v, _ := ctx.Value(roleKey).(string)
	return v
}

// SetConn stores the database connection in the context.
func SetConn(ctx context.Context, conn *pgxpool.Conn) context.Context {
	return context.WithValue(ctx, connKey, conn)
}

// GetConn retrieves the database connection from the context.
func GetConn(ctx context.Context) *pgxpool.Conn {
	v, _ := ctx.Value(connKey).(*pgxpool.Conn)
	return v
}
