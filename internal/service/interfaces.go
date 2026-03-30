package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

// AuthService handles user registration, login, token management, and password reset.
type AuthService interface {
	// Signup creates a new tenant and an admin user, returns auth tokens.
	Signup(ctx context.Context, params SignupParams) (*domain.AuthResult, error)
	// Login authenticates a user by email and password, returns auth tokens.
	Login(ctx context.Context, email, password string) (*domain.AuthResult, error)
	// RefreshToken issues new access/refresh token pair using a valid refresh token.
	RefreshToken(ctx context.Context, refreshToken string) (*domain.AuthResult, error)
	// Logout revokes the provided refresh token.
	Logout(ctx context.Context, refreshToken string) error
	// GetMe returns the authenticated user's profile.
	GetMe(ctx context.Context, actor domain.Actor) (*domain.UserProfile, error)
	// RequestPasswordReset sends a password reset email.
	RequestPasswordReset(ctx context.Context, email string) error
	// ExecutePasswordReset validates the token and updates the password.
	ExecutePasswordReset(ctx context.Context, token, newPassword string) error
}

// ReportService handles CRUD and listing for expense reports.
type ReportService interface {
	// CreateReport creates a new expense report owned by the actor.
	CreateReport(ctx context.Context, actor domain.Actor, params CreateReportParams) (*domain.ExpenseReportDetail, error)
	// GetReport retrieves the full detail of a single report.
	GetReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID) (*domain.ExpenseReportDetail, error)
	// ListMyReports lists reports owned by the actor with cursor-based pagination.
	ListMyReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error)
	// ListAllReports lists all reports within the tenant (Admin / Accounting only).
	ListAllReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error)
	// UpdateReport updates the mutable fields of a draft report.
	UpdateReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, params UpdateReportParams) (*domain.ExpenseReportDetail, error)
	// DeleteReport soft-deletes a draft report.
	DeleteReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID) error
	// SubmitReport transitions a draft report to submitted status.
	SubmitReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, updatedAt time.Time) (*domain.ExpenseReportDetail, error)
}

// ItemService handles CRUD for expense items within a report.
type ItemService interface {
	// CreateItem creates a new expense item within a draft report.
	CreateItem(ctx context.Context, actor domain.Actor, reportID uuid.UUID, params CreateItemParams) (*domain.ExpenseItemDTO, error)
	// UpdateItem updates the mutable fields of an expense item.
	UpdateItem(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID, params UpdateItemParams) (*domain.ExpenseItemDTO, error)
	// DeleteItem soft-deletes an expense item.
	DeleteItem(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID) error
}

// AttachmentService handles file upload and retrieval for attachments.
type AttachmentService interface {
	// UploadAttachment stores a file and persists the attachment metadata.
	UploadAttachment(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID, upload FileUpload) (*domain.AttachmentDTO, error)
	// ListAttachments retrieves all active attachments for an item.
	ListAttachments(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID) ([]domain.AttachmentDTO, error)
	// GetAttachmentDownload returns a pre-signed S3 URL for downloading the file.
	GetAttachmentDownload(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) (*domain.AttachmentDownload, error)
	// DeleteAttachment soft-deletes an attachment.
	DeleteAttachment(ctx context.Context, actor domain.Actor, reportID, itemID, attachmentID uuid.UUID) error
}

// WorkflowService handles approval, rejection, and payment of expense reports.
type WorkflowService interface {
	// ListPendingReports returns submitted reports awaiting approval.
	ListPendingReports(ctx context.Context, actor domain.Actor, params domain.WorkflowListParams) ([]domain.PendingReport, *domain.Pagination, error)
	// ApproveReport transitions a submitted report to approved.
	ApproveReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, comment *string, updatedAt time.Time) (*domain.ExpenseReportDetail, error)
	// RejectReport transitions a submitted report to rejected.
	RejectReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, reason string, updatedAt time.Time) (*domain.ExpenseReportDetail, error)
	// ListPayableReports returns approved reports awaiting payment.
	ListPayableReports(ctx context.Context, actor domain.Actor, params domain.WorkflowListParams) ([]domain.PayableReport, *domain.Pagination, error)
	// MarkReportAsPaid transitions an approved report to paid.
	MarkReportAsPaid(ctx context.Context, actor domain.Actor, reportID uuid.UUID, updatedAt time.Time) (*domain.ExpenseReportDetail, error)
}

// DashboardService builds the role-specific dashboard payload.
type DashboardService interface {
	// GetDashboard returns the dashboard data for the authenticated actor.
	GetDashboard(ctx context.Context, actor domain.Actor) (*domain.DashboardData, error)
}

// CategoryService provides read access to expense category master data.
type CategoryService interface {
	// ListCategories returns active categories visible within the actor's tenant.
	ListCategories(ctx context.Context, actor domain.Actor) ([]domain.CategoryDTO, error)
}

// TenantService provides tenant and membership information.
type TenantService interface {
	// GetTenant returns basic tenant information (Admin only).
	GetTenant(ctx context.Context, actor domain.Actor) (*domain.TenantInfoDTO, error)
	// ListTenantMembers returns all active members within the actor's tenant.
	ListTenantMembers(ctx context.Context, actor domain.Actor) ([]domain.UserSummary, error)
}
