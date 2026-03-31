package service

import (
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// SignupParams holds the parameters required to create a new tenant and its first user.
type SignupParams struct {
	CompanyName string
	Email       string
	Name        string
	Password    string
}

// CreateReportParams holds the parameters required to create a new expense report.
type CreateReportParams struct {
	Title             string
	PeriodStart       time.Time
	PeriodEnd         time.Time
	ReferenceReportID *uuid.UUID
}

// UpdateReportParams holds the mutable fields for updating an expense report.
type UpdateReportParams struct {
	Title       string
	PeriodStart time.Time
	PeriodEnd   time.Time
	UpdatedAt   time.Time
}

// CreateItemParams holds the parameters required to create a new expense item.
type CreateItemParams struct {
	ExpenseDate time.Time
	Amount      int
	CategoryID  uuid.UUID
	Description string
}

// UpdateItemParams holds the mutable fields for updating an expense item.
type UpdateItemParams struct {
	ExpenseDate time.Time
	Amount      int
	CategoryID  uuid.UUID
	Description string
	UpdatedAt   time.Time
}

// FileUpload holds metadata for an uploaded file together with its binary content.
type FileUpload struct {
	FileName string
	FileSize int
	MimeType domain.MimeType
	Content  []byte
}
