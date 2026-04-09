package middleware

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const (
	requestIDKey   contextKey = "request_id"
	userIDKey      contextKey = "user_id"
	tenantIDKey    contextKey = "tenant_id"
	roleKey        contextKey = "role"
	connKey        contextKey = "conn"
	requestInfoKey contextKey = "request_info"
	txKey          contextKey = "tx"
)

// RequestInfo は Logger がコンテキストに格納するミュータブルな構造体です。
// ServeHTTP の呼び出し後、下流の middleware（Auth、TenantContext）が
// ユーザー・テナント情報を Logger へ逆伝播するために使用します。
type RequestInfo struct {
	UserID   string
	TenantID string
	Role     string
}

// GetRequestInfo はコンテキストから RequestInfo ポインタを取得します。
// 未設定の場合は nil を返します。
func GetRequestInfo(ctx context.Context) *RequestInfo {
	info, _ := ctx.Value(requestInfoKey).(*RequestInfo)
	return info
}

// SetRequestID はリクエスト ID をコンテキストに格納します。
func SetRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

// GetRequestID はコンテキストからリクエスト ID を取得します。
func GetRequestID(ctx context.Context) string {
	v, _ := ctx.Value(requestIDKey).(string)
	return v
}

// SetUserID はユーザー ID をコンテキストに格納します。
func SetUserID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, userIDKey, id)
}

// GetUserID はコンテキストからユーザー ID を取得します。
func GetUserID(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}

// SetTenantID はテナント ID をコンテキストに格納します。
func SetTenantID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, tenantIDKey, id)
}

// GetTenantID はコンテキストからテナント ID を取得します。
func GetTenantID(ctx context.Context) string {
	v, _ := ctx.Value(tenantIDKey).(string)
	return v
}

// SetRole はロールをコンテキストに格納します。
func SetRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, roleKey, role)
}

// GetRole はコンテキストからロールを取得します。
func GetRole(ctx context.Context) string {
	v, _ := ctx.Value(roleKey).(string)
	return v
}

// SetConn はデータベース接続をコンテキストに格納します。
func SetConn(ctx context.Context, conn *pgxpool.Conn) context.Context {
	return context.WithValue(ctx, connKey, conn)
}

// GetConn はコンテキストからデータベース接続を取得します。
func GetConn(ctx context.Context) *pgxpool.Conn {
	v, _ := ctx.Value(connKey).(*pgxpool.Conn)
	return v
}

// SetTx はトランザクションをコンテキストに格納する。
func SetTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, txKey, tx)
}

// GetTx はコンテキストからトランザクションを取得する。
func GetTx(ctx context.Context) pgx.Tx {
	v, _ := ctx.Value(txKey).(pgx.Tx)
	return v
}
