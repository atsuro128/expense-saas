package service

import (
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// SignupParams は新規テナントと最初のユーザーを作成するために必要なパラメータを保持する。
type SignupParams struct {
	CompanyName string
	Email       string
	Name        string
	Password    string
}

// CreateReportParams は新規経費レポートを作成するために必要なパラメータを保持する。
type CreateReportParams struct {
	Title             string
	PeriodStart       time.Time
	PeriodEnd         time.Time
	ReferenceReportID *uuid.UUID
}

// UpdateReportParams は経費レポートの更新対象フィールドを保持する。
type UpdateReportParams struct {
	Title       string
	PeriodStart time.Time
	PeriodEnd   time.Time
	UpdatedAt   time.Time
}

// CreateItemParams は新規経費項目を作成するために必要なパラメータを保持する。
type CreateItemParams struct {
	ExpenseDate time.Time
	Amount      int
	CategoryID  uuid.UUID
	Description string
}

// UpdateItemParams は経費項目の更新対象フィールドを保持する。
type UpdateItemParams struct {
	ExpenseDate time.Time
	Amount      int
	CategoryID  uuid.UUID
	Description string
	UpdatedAt   time.Time
}

// FileUpload はアップロードされたファイルのメタデータとバイナリ内容を保持する。
type FileUpload struct {
	FileName string
	FileSize int
	MimeType domain.MimeType
	Content  []byte
}
