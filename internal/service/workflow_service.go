package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type workflowService struct {
	reportRepo     domain.ReportRepository
	userRepo       domain.UserRepository
	membershipRepo domain.MembershipRepository
	authorizer     Authorizer
}

// NewWorkflowService は WorkflowService を生成して返す。
func NewWorkflowService(
	reportRepo domain.ReportRepository,
	userRepo domain.UserRepository,
	membershipRepo domain.MembershipRepository,
	authorizer Authorizer,
) WorkflowService {
	return &workflowService{
		reportRepo:     reportRepo,
		userRepo:       userRepo,
		membershipRepo: membershipRepo,
		authorizer:     authorizer,
	}
}

// ListPendingReports は承認待ちの提出済みレポートを一覧取得する。
func (s *workflowService) ListPendingReports(ctx context.Context, actor domain.Actor, params domain.WorkflowListParams) ([]PendingReport, *Pagination, error) {
	reports, total, err := s.reportRepo.ListPending(ctx, actor.TenantID, params)
	if err != nil {
		return nil, nil, fmt.Errorf("workflowService.ListPendingReports: %w", err)
	}

	// ユーザーキャッシュを構築する。
	userCache := make(map[uuid.UUID]UserSummary)
	pendingReports := make([]PendingReport, len(reports))
	for i, r := range reports {
		if _, ok := userCache[r.UserID]; !ok {
			u, err := s.userRepo.GetByID(ctx, r.UserID)
			if err == nil {
				userCache[r.UserID] = UserSummary{ID: u.UserID, Name: u.Name}
			}
		}
		submitter := userCache[r.UserID]
		var submittedAt time.Time
		if r.SubmittedAt != nil {
			submittedAt = *r.SubmittedAt
		}
		pendingReports[i] = PendingReport{
			ID:          r.ReportID,
			Title:       r.Title,
			TotalAmount: r.TotalAmount,
			SubmittedAt: submittedAt,
			Submitter:   submitter,
			IsOwnReport: r.UserID == actor.UserID,
		}
	}

	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}
	pagination := &Pagination{
		CurrentPage: page,
		PerPage:     perPage,
		TotalCount:  total,
		TotalPages:  totalPages,
	}

	return pendingReports, pagination, nil
}

// ApproveReport は提出済みレポートを承認済みステータスへ遷移させる。
func (s *workflowService) ApproveReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, comment *string, updatedAt time.Time) (*ExpenseReportDetail, error) {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 自己承認チェック。
	if err := s.authorizer.CanApproveOrReject(actor, report); err != nil {
		return nil, err
	}

	// 楽観的ロックチェック。
	if !report.UpdatedAt.Equal(updatedAt) {
		return nil, domain.ErrConflict
	}

	// ドメイン層で状態遷移を実行する。
	if err := report.Approve(actor.UserID, comment); err != nil {
		return nil, err
	}

	// updated_at は SQL 側で now() に設定され、RETURNING で反映されるため、ここでは変更しない。
	if err := s.reportRepo.UpdateStatus(ctx, report); err != nil {
		return nil, err
	}

	return s.buildWorkflowDetail(ctx, actor, report)
}

// RejectReport は提出済みレポートを却下済みステータスへ遷移させる。
func (s *workflowService) RejectReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, reason string, updatedAt time.Time) (*ExpenseReportDetail, error) {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 自己却下チェック。
	if err := s.authorizer.CanApproveOrReject(actor, report); err != nil {
		return nil, err
	}

	// 楽観的ロックチェック。
	if !report.UpdatedAt.Equal(updatedAt) {
		return nil, domain.ErrConflict
	}

	// ドメイン層で状態遷移を実行する。
	if err := report.Reject(actor.UserID, reason); err != nil {
		return nil, err
	}

	// updated_at は SQL 側で now() に設定され、RETURNING で反映されるため、ここでは変更しない。
	if err := s.reportRepo.UpdateStatus(ctx, report); err != nil {
		return nil, err
	}

	return s.buildWorkflowDetail(ctx, actor, report)
}

// ListPayableReports は支払待ちの承認済みレポートを一覧取得する。
func (s *workflowService) ListPayableReports(ctx context.Context, actor domain.Actor, params domain.WorkflowListParams) ([]PayableReport, *Pagination, error) {
	reports, total, err := s.reportRepo.ListPayable(ctx, actor.TenantID, params)
	if err != nil {
		return nil, nil, fmt.Errorf("workflowService.ListPayableReports: %w", err)
	}

	// ユーザーキャッシュを構築する。
	userCache := make(map[uuid.UUID]UserSummary)
	payableReports := make([]PayableReport, len(reports))
	for i, r := range reports {
		if _, ok := userCache[r.UserID]; !ok {
			u, err := s.userRepo.GetByID(ctx, r.UserID)
			if err == nil {
				userCache[r.UserID] = UserSummary{ID: u.UserID, Name: u.Name}
			}
		}
		submitter := userCache[r.UserID]
		var approvedAt time.Time
		if r.ApprovedAt != nil {
			approvedAt = *r.ApprovedAt
		}
		payableReports[i] = PayableReport{
			ID:          r.ReportID,
			Title:       r.Title,
			TotalAmount: r.TotalAmount,
			ApprovedAt:  approvedAt,
			Submitter:   submitter,
			IsOwnReport: r.UserID == actor.UserID,
		}
	}

	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}
	pagination := &Pagination{
		CurrentPage: page,
		PerPage:     perPage,
		TotalCount:  total,
		TotalPages:  totalPages,
	}

	return payableReports, pagination, nil
}

// MarkReportAsPaid は承認済みレポートを支払済みステータスへ遷移させる。
func (s *workflowService) MarkReportAsPaid(ctx context.Context, actor domain.Actor, reportID uuid.UUID, updatedAt time.Time) (*ExpenseReportDetail, error) {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 自己支払チェック。
	if err := s.authorizer.CanMarkAsPaid(actor, report); err != nil {
		return nil, err
	}

	// 楽観的ロックチェック。
	if !report.UpdatedAt.Equal(updatedAt) {
		return nil, domain.ErrConflict
	}

	// ドメイン層で状態遷移を実行する。
	if err := report.MarkAsPaid(actor.UserID); err != nil {
		return nil, err
	}

	// updated_at は SQL 側で now() に設定され、RETURNING で反映されるため、ここでは変更しない。
	if err := s.reportRepo.UpdateStatus(ctx, report); err != nil {
		return nil, err
	}

	return s.buildWorkflowDetail(ctx, actor, report)
}

// buildWorkflowDetail はワークフロー操作後のレポート詳細を構築する（items は空）。
func (s *workflowService) buildWorkflowDetail(ctx context.Context, actor domain.Actor, report *domain.ExpenseReport) (*ExpenseReportDetail, error) {
	// 提出者情報を取得する。
	submitter, err := s.userRepo.GetByID(ctx, report.UserID)
	if err != nil {
		return nil, fmt.Errorf("workflowService.buildWorkflowDetail (submitter): %w", err)
	}

	detail := &ExpenseReportDetail{
		ID:                report.ReportID,
		Title:             report.Title,
		PeriodStart:       report.PeriodStart.Format("2006-01-02"),
		PeriodEnd:         report.PeriodEnd.Format("2006-01-02"),
		Status:            report.Status,
		TotalAmount:       report.TotalAmount,
		Submitter:         UserSummary{ID: submitter.UserID, Name: submitter.Name},
		ReferenceReportID: report.ReferenceReportID,
		SubmittedAt:       report.SubmittedAt,
		ApprovedAt:        report.ApprovedAt,
		ApprovalComment:   report.ApprovalComment,
		RejectedAt:        report.RejectedAt,
		RejectionReason:   report.RejectionReason,
		PaidAt:            report.PaidAt,
		Items:             []ExpenseItemDTO{},
		CreatedAt:         report.CreatedAt,
		UpdatedAt:         report.UpdatedAt,
	}

	// ApprovedBy ユーザー情報を解決する。
	if report.ApprovedBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.ApprovedBy)
		if err == nil {
			us := UserSummary{ID: u.UserID, Name: u.Name}
			detail.ApprovedBy = &us
		}
	}

	// RejectedBy ユーザー情報を解決する。
	if report.RejectedBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.RejectedBy)
		if err == nil {
			us := UserSummary{ID: u.UserID, Name: u.Name}
			detail.RejectedBy = &us
		}
	}

	// PaidBy ユーザー情報を解決する。
	if report.PaidBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.PaidBy)
		if err == nil {
			us := UserSummary{ID: u.UserID, Name: u.Name}
			detail.PaidBy = &us
		}
	}

	// SubmittedBy ユーザー情報を解決する。
	if report.SubmittedBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.SubmittedBy)
		if err == nil {
			us := UserSummary{ID: u.UserID, Name: u.Name}
			detail.SubmittedBy = &us
		}
	}

	_ = actor // 将来の拡張のために保持
	return detail, nil
}
