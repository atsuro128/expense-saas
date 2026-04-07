package domain

import "github.com/google/uuid"

// Actor はテナントコンテキスト内で操作を行う認証済みユーザーを表す。
// Auth ミドルウェアが JWT クレームを検証した後に生成される。
type Actor struct {
	UserID   uuid.UUID
	TenantID uuid.UUID
	Role     Role
}
