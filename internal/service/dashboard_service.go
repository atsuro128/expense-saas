package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type dashboardService struct {
	reportRepo     domain.ReportRepository
	membershipRepo domain.MembershipRepository
}

// NewDashboardService は DashboardService を生成して返す。
func NewDashboardService(
	reportRepo domain.ReportRepository,
	membershipRepo domain.MembershipRepository,
) DashboardService {
	return &dashboardService{
		reportRepo:     reportRepo,
		membershipRepo: membershipRepo,
	}
}

// GetDashboard はアクターのロールに応じたダッシュボードデータを構築して返す。
// ロール別フィールド設定方針:
//   - Member: my_* 系フィールド + recent_reports
//   - Approver: Member フィールド + pending_approval_count + monthly_summary
//   - Accounting: Member フィールド + pending_payment_count + monthly_summary
//   - Admin: tenant_* 系フィールド + monthly_summary（my_* 系は設定しない）
func (s *dashboardService) GetDashboard(ctx context.Context, actor domain.Actor) (*DashboardData, error) {
	data := &DashboardData{}

	switch actor.Role {
	case domain.RoleMember:
		if err := s.fillMemberFields(ctx, actor.TenantID, actor.UserID, data); err != nil {
			return nil, err
		}

	case domain.RoleApprover:
		if err := s.fillMemberFields(ctx, actor.TenantID, actor.UserID, data); err != nil {
			return nil, err
		}
		if err := s.fillApproverFields(ctx, actor.TenantID, actor.UserID, data); err != nil {
			return nil, err
		}
		if err := s.fillMonthlySummary(ctx, actor.TenantID, data); err != nil {
			return nil, err
		}

	case domain.RoleAccounting:
		if err := s.fillMemberFields(ctx, actor.TenantID, actor.UserID, data); err != nil {
			return nil, err
		}
		if err := s.fillAccountingFields(ctx, actor.TenantID, data); err != nil {
			return nil, err
		}
		if err := s.fillMonthlySummary(ctx, actor.TenantID, data); err != nil {
			return nil, err
		}

	case domain.RoleAdmin:
		if err := s.fillAdminFields(ctx, actor.TenantID, data); err != nil {
			return nil, err
		}
		if err := s.fillMonthlySummary(ctx, actor.TenantID, data); err != nil {
			return nil, err
		}
	}

	return data, nil
}

// fillMemberFields は Member / Approver / Accounting 共通フィールドを設定する。
// my_draft_count, my_submitted_count, my_rejected_count, recent_reports を設定する。
func (s *dashboardService) fillMemberFields(ctx context.Context, tenantID, userID uuid.UUID, data *DashboardData) error {
	// ユーザー別ステータス集計を取得する。
	counts, err := s.reportRepo.CountByStatus(ctx, tenantID, &userID)
	if err != nil {
		return fmt.Errorf("dashboardService.fillMemberFields: CountByStatus: %w", err)
	}

	draft := counts[domain.ReportStatusDraft]
	submitted := counts[domain.ReportStatusSubmitted]
	rejected := counts[domain.ReportStatusRejected]

	data.MyDraftCount = &draft
	data.MySubmittedCount = &submitted
	data.MyRejectedCount = &rejected

	// 直近5件のレポートを取得する。
	recent, err := s.reportRepo.ListRecentReports(ctx, tenantID, userID, 5)
	if err != nil {
		return fmt.Errorf("dashboardService.fillMemberFields: ListRecentReports: %w", err)
	}

	recentReports := make([]RecentReport, len(recent))
	for i, r := range recent {
		recentReports[i] = RecentReport{
			ID:          r.ReportID,
			Title:       r.Title,
			PeriodStart: r.PeriodStart,
			PeriodEnd:   r.PeriodEnd,
			TotalAmount: r.TotalAmount,
			Status:      r.Status,
			UpdatedAt:   r.UpdatedAt,
		}
	}
	// ポインタ代入: ゼロ件でも JSON に [] として含めるためポインタで設定する。
	// nil（省略）ではなく &[]（空配列）として返すことで「フィールドなし」と区別できる。
	data.RecentReports = &recentReports

	return nil
}

// fillApproverFields は Approver 専用フィールド（pending_approval_count）を設定する。
// テナント全体の submitted 件数からアクター自身の submitted 件数を引いた値を設定する。
func (s *dashboardService) fillApproverFields(ctx context.Context, tenantID, actorUserID uuid.UUID, data *DashboardData) error {
	// テナント全体の submitted 件数を取得する。
	allCounts, err := s.reportRepo.CountByStatus(ctx, tenantID, nil)
	if err != nil {
		return fmt.Errorf("dashboardService.fillApproverFields: CountByStatus(all): %w", err)
	}
	totalSubmitted := allCounts[domain.ReportStatusSubmitted]

	// アクター自身の submitted 件数を取得する。
	myCounts, err := s.reportRepo.CountByStatus(ctx, tenantID, &actorUserID)
	if err != nil {
		return fmt.Errorf("dashboardService.fillApproverFields: CountByStatus(my): %w", err)
	}
	mySubmitted := myCounts[domain.ReportStatusSubmitted]

	// 差分が pending_approval_count（自分を除いた承認待ち件数）。
	pending := totalSubmitted - mySubmitted
	data.PendingApprovalCount = &pending

	return nil
}

// fillAccountingFields は Accounting 専用フィールド（pending_payment_count）を設定する。
// テナント全体の approved 件数を返す。
func (s *dashboardService) fillAccountingFields(ctx context.Context, tenantID uuid.UUID, data *DashboardData) error {
	allCounts, err := s.reportRepo.CountByStatus(ctx, tenantID, nil)
	if err != nil {
		return fmt.Errorf("dashboardService.fillAccountingFields: CountByStatus: %w", err)
	}
	approved := allCounts[domain.ReportStatusApproved]
	data.PendingPaymentCount = &approved

	return nil
}

// fillAdminFields は Admin 専用フィールド（tenant_* カウント群および tenant_member_count）を設定する。
// Admin はテナント全体集計のみを取得するため、my_* 系フィールドは設定しない。
func (s *dashboardService) fillAdminFields(ctx context.Context, tenantID uuid.UUID, data *DashboardData) error {
	// テナント全体のステータス別集計を取得する。
	allCounts, err := s.reportRepo.CountByStatus(ctx, tenantID, nil)
	if err != nil {
		return fmt.Errorf("dashboardService.fillAdminFields: CountByStatus: %w", err)
	}

	draft := allCounts[domain.ReportStatusDraft]
	submitted := allCounts[domain.ReportStatusSubmitted]
	approved := allCounts[domain.ReportStatusApproved]
	rejected := allCounts[domain.ReportStatusRejected]
	paid := allCounts[domain.ReportStatusPaid]

	data.TenantDraftCount = &draft
	data.TenantSubmittedCount = &submitted
	data.TenantApprovedCount = &approved
	data.TenantRejectedCount = &rejected
	data.TenantPaidCount = &paid

	// テナントのメンバー数を取得する。
	memberCount, err := s.membershipRepo.CountByTenantID(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("dashboardService.fillAdminFields: CountByTenantID: %w", err)
	}
	data.TenantMemberCount = &memberCount

	return nil
}

// fillMonthlySummary は直近3ヶ月の月別集計（monthly_summary）を設定する。
// テナント全体の集計（userID = nil）を使用する。
func (s *dashboardService) fillMonthlySummary(ctx context.Context, tenantID uuid.UUID, data *DashboardData) error {
	summary, err := s.reportRepo.MonthlySummary(ctx, tenantID, nil, 3)
	if err != nil {
		return fmt.Errorf("dashboardService.fillMonthlySummary: MonthlySummary: %w", err)
	}
	// ポインタ代入: ゼロ件でも JSON に [] として含めるためポインタで設定する。
	// nil（省略）ではなく &[]（空配列）として返すことで「フィールドなし」と区別できる。
	data.MonthlySummary = &summary

	return nil
}
