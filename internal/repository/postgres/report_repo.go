package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type reportRepo struct {
	pool *pgxpool.Pool
}

// NewReportRepo は PostgreSQL をバックエンドとする ReportRepository を生成して返す。
func NewReportRepo(pool *pgxpool.Pool) domain.ReportRepository {
	return &reportRepo{pool: pool}
}

func (r *reportRepo) Create(
	ctx context.Context,
	tenantID, userID uuid.UUID,
	title string,
	periodStart, periodEnd time.Time,
	referenceReportID *uuid.UUID,
) (*domain.ExpenseReport, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateReport(ctx, sqlcgen.CreateReportParams{
		TenantID:          tenantID,
		UserID:            userID,
		Title:             title,
		PeriodStart:       toPgtypeDate(periodStart),
		PeriodEnd:         toPgtypeDate(periodEnd),
		ReferenceReportID: toPgtypeUUID(referenceReportID),
	})
	if err != nil {
		return nil, fmt.Errorf("reportRepo.Create: %w", err)
	}
	return reportFromRow(row), nil
}

func (r *reportRepo) GetByID(ctx context.Context, tenantID, reportID uuid.UUID) (*domain.ExpenseReport, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetReportByID(ctx, sqlcgen.GetReportByIDParams{
		TenantID: tenantID,
		ReportID: reportID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("reportRepo.GetByID: %w", err)
	}
	return reportFromRow(row), nil
}

func (r *reportRepo) List(ctx context.Context, tenantID uuid.UUID, params domain.ReportListParams) ([]domain.ExpenseReport, int, error) {
	q := queries(ctx, r.pool)

	// PerPage のデフォルト・上限を設定する。
	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	// NULL 許容フィルタパラメータを構築する。
	var statusParam pgtype.Text
	if params.Status != nil {
		statusParam = pgtype.Text{String: string(*params.Status), Valid: true}
	}
	var fromParam pgtype.Date
	if params.From != nil {
		fromParam = pgtype.Date{Time: *params.From, Valid: true}
	}
	var toParam pgtype.Date
	if params.To != nil {
		toParam = pgtype.Date{Time: *params.To, Valid: true}
	}

	var rows []sqlcgen.ExpenseReport
	var total int32
	var err error

	if params.UserID != nil {
		rows, err = q.ListReportsByUser(ctx, sqlcgen.ListReportsByUserParams{
			TenantID: tenantID,
			UserID:   *params.UserID,
			Limit:    int32(perPage),
			Offset:   int32(offset),
			Status:   statusParam,
			FromDate: fromParam,
			ToDate:   toParam,
		})
		if err != nil {
			return nil, 0, fmt.Errorf("reportRepo.List: %w", err)
		}
		total, err = q.CountReportsByUser(ctx, sqlcgen.CountReportsByUserParams{
			TenantID: tenantID,
			UserID:   *params.UserID,
			Status:   statusParam,
			FromDate: fromParam,
			ToDate:   toParam,
		})
	} else {
		rows, err = q.ListAllReports(ctx, sqlcgen.ListAllReportsParams{
			TenantID: tenantID,
			Limit:    int32(perPage),
			Offset:   int32(offset),
			Status:   statusParam,
			FromDate: fromParam,
			ToDate:   toParam,
			UserID:   toPgtypeUUID(params.SubmitterID),
		})
		if err != nil {
			return nil, 0, fmt.Errorf("reportRepo.List: %w", err)
		}
		total, err = q.CountAllReports(ctx, sqlcgen.CountAllReportsParams{
			TenantID: tenantID,
			Status:   statusParam,
			FromDate: fromParam,
			ToDate:   toParam,
			UserID:   toPgtypeUUID(params.SubmitterID),
		})
	}
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.List: %w", err)
	}

	result := make([]domain.ExpenseReport, len(rows))
	for i, row := range rows {
		rpt := reportFromRow(row)
		result[i] = *rpt
	}
	return result, int(total), nil
}

func (r *reportRepo) Update(ctx context.Context, report *domain.ExpenseReport) error {
	q := queries(ctx, r.pool)
	updated, err := q.UpdateReport(ctx, sqlcgen.UpdateReportParams{
		TenantID:    report.TenantID,
		ReportID:    report.ReportID,
		Title:       report.Title,
		PeriodStart: toPgtypeDate(report.PeriodStart),
		PeriodEnd:   toPgtypeDate(report.PeriodEnd),
		UpdatedAt:   report.UpdatedAt,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// ErrNoRows はレポートが存在しないか、楽観ロックが失敗したことを意味する。
			return domain.ErrConflict
		}
		return fmt.Errorf("reportRepo.Update: %w", err)
	}
	// 更新後の状態を引数のエンティティに反映する。
	*report = *reportFromRow(updated)
	return nil
}

func (r *reportRepo) SoftDelete(ctx context.Context, tenantID, reportID uuid.UUID) error {
	q := queries(ctx, r.pool)
	// 関連する経費項目を論理削除（カスケード）する。
	if err := q.SoftDeleteExpenseItemsByReportID(ctx, sqlcgen.SoftDeleteExpenseItemsByReportIDParams{
		TenantID: tenantID,
		ReportID: reportID,
	}); err != nil {
		return fmt.Errorf("reportRepo.SoftDelete (items): %w", err)
	}
	// 関連する添付ファイルを論理削除（カスケード）する。
	if err := q.SoftDeleteAttachmentsByReportID(ctx, sqlcgen.SoftDeleteAttachmentsByReportIDParams{
		TenantID: tenantID,
		ReportID: reportID,
	}); err != nil {
		return fmt.Errorf("reportRepo.SoftDelete (attachments): %w", err)
	}
	if err := q.SoftDeleteReport(ctx, sqlcgen.SoftDeleteReportParams{
		TenantID: tenantID,
		ReportID: reportID,
	}); err != nil {
		return fmt.Errorf("reportRepo.SoftDelete: %w", err)
	}
	return nil
}

func (r *reportRepo) UpdateStatus(ctx context.Context, report *domain.ExpenseReport) error {
	q := queries(ctx, r.pool)

	toPgtypeTimestamptz := func(t *time.Time) pgtype.Timestamptz {
		if t == nil {
			return pgtype.Timestamptz{Valid: false}
		}
		return pgtype.Timestamptz{Time: *t, Valid: true}
	}
	toPgtypeText := func(s *string) pgtype.Text {
		if s == nil {
			return pgtype.Text{Valid: false}
		}
		return pgtype.Text{String: *s, Valid: true}
	}

	updated, err := q.UpdateReportStatus(ctx, sqlcgen.UpdateReportStatusParams{
		TenantID:        report.TenantID,
		ReportID:        report.ReportID,
		Status:          string(report.Status),
		SubmittedBy:     toPgtypeUUID(report.SubmittedBy),
		SubmittedAt:     toPgtypeTimestamptz(report.SubmittedAt),
		ApprovedBy:      toPgtypeUUID(report.ApprovedBy),
		ApprovedAt:      toPgtypeTimestamptz(report.ApprovedAt),
		ApprovalComment: toPgtypeText(report.ApprovalComment),
		RejectedBy:      toPgtypeUUID(report.RejectedBy),
		RejectedAt:      toPgtypeTimestamptz(report.RejectedAt),
		RejectionReason: toPgtypeText(report.RejectionReason),
		PaidBy:          toPgtypeUUID(report.PaidBy),
		PaidAt:          toPgtypeTimestamptz(report.PaidAt),
		UpdatedAt:       report.UpdatedAt,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// ErrNoRows はレポートが存在しないか、楽観ロックが失敗したことを意味する。
			return domain.ErrConflict
		}
		return fmt.Errorf("reportRepo.UpdateStatus: %w", err)
	}
	// 更新後の状態を引数のエンティティに反映する。
	*report = *reportFromRow(updated)
	return nil
}

func (r *reportRepo) CountByStatus(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID) (map[domain.ReportStatus]int, error) {
	q := queries(ctx, r.pool)

	result := make(map[domain.ReportStatus]int)

	if userID != nil {
		rows, err := q.CountMyReportsByStatus(ctx, sqlcgen.CountMyReportsByStatusParams{
			TenantID: tenantID,
			UserID:   *userID,
		})
		if err != nil {
			return nil, fmt.Errorf("reportRepo.CountByStatus: %w", err)
		}
		for _, row := range rows {
			result[domain.ReportStatus(row.Status)] = int(row.Count)
		}
	} else {
		rows, err := q.CountReportsByStatus(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("reportRepo.CountByStatus: %w", err)
		}
		for _, row := range rows {
			result[domain.ReportStatus(row.Status)] = int(row.Count)
		}
	}

	return result, nil
}

func (r *reportRepo) MonthlySummary(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID, numMonths int) ([]domain.MonthlySummary, error) {
	q := queries(ctx, r.pool)

	var result []domain.MonthlySummary

	if userID != nil {
		rows, err := q.MonthlySummaryByUser(ctx, sqlcgen.MonthlySummaryByUserParams{
			TenantID: tenantID,
			UserID:   *userID,
			Column3:  int32(numMonths),
		})
		if err != nil {
			return nil, fmt.Errorf("reportRepo.MonthlySummary: %w", err)
		}
		result = make([]domain.MonthlySummary, len(rows))
		for i, row := range rows {
			result[i] = domain.MonthlySummary{
				YearMonth:   row.YearMonth,
				TotalAmount: int(row.TotalAmount),
			}
		}
	} else {
		rows, err := q.MonthlySummaryAll(ctx, sqlcgen.MonthlySummaryAllParams{
			TenantID: tenantID,
			Column2:  int32(numMonths),
		})
		if err != nil {
			return nil, fmt.Errorf("reportRepo.MonthlySummary: %w", err)
		}
		result = make([]domain.MonthlySummary, len(rows))
		for i, row := range rows {
			result[i] = domain.MonthlySummary{
				YearMonth:   row.YearMonth,
				TotalAmount: int(row.TotalAmount),
			}
		}
	}

	return result, nil
}

func (r *reportRepo) ListPending(ctx context.Context, tenantID uuid.UUID, params domain.WorkflowListParams) ([]domain.ExpenseReport, int, error) {
	q := queries(ctx, r.pool)

	// PerPage のデフォルト・上限を設定する。
	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	var applicantNameParam pgtype.Text
	if params.ApplicantName != nil {
		applicantNameParam = pgtype.Text{String: *params.ApplicantName, Valid: true}
	}

	rows, err := q.ListPendingReports(ctx, sqlcgen.ListPendingReportsParams{
		TenantID:      tenantID,
		Limit:         int32(perPage),
		Offset:        int32(offset),
		ApplicantName: applicantNameParam,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.ListPending: %w", err)
	}

	total, err := q.CountPendingReports(ctx, sqlcgen.CountPendingReportsParams{
		TenantID:      tenantID,
		ApplicantName: applicantNameParam,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.ListPending (count): %w", err)
	}

	result := make([]domain.ExpenseReport, len(rows))
	for i, row := range rows {
		rpt := reportFromRow(row)
		result[i] = *rpt
	}
	return result, int(total), nil
}

func (r *reportRepo) ListProcessed(ctx context.Context, tenantID, approverID uuid.UUID, params domain.WorkflowListParams) ([]domain.ExpenseReport, int, error) {
	q := queries(ctx, r.pool)

	// PerPage のデフォルト・上限を設定する。
	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	// approverID を pgtype.UUID に変換する（$2 は approved_by / rejected_by の両方に使用される）。
	approverIDParam := pgtype.UUID{Bytes: approverID, Valid: true}

	rows, err := q.ListProcessedReports(ctx, sqlcgen.ListProcessedReportsParams{
		TenantID:   tenantID,
		ApprovedBy: approverIDParam,
		Limit:      int32(perPage),
		Offset:     int32(offset),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.ListProcessed: %w", err)
	}

	total, err := q.CountProcessedReports(ctx, sqlcgen.CountProcessedReportsParams{
		TenantID:   tenantID,
		ApprovedBy: approverIDParam,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.ListProcessed (count): %w", err)
	}

	result := make([]domain.ExpenseReport, len(rows))
	for i, row := range rows {
		rpt := reportFromRow(row)
		result[i] = *rpt
	}
	return result, int(total), nil
}

func (r *reportRepo) ListRecentReports(ctx context.Context, tenantID, userID uuid.UUID, limit int) ([]domain.ExpenseReport, error) {
	q := queries(ctx, r.pool)
	rows, err := q.ListRecentReports(ctx, sqlcgen.ListRecentReportsParams{
		TenantID: tenantID,
		UserID:   userID,
		Limit:    int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("reportRepo.ListRecentReports: %w", err)
	}
	result := make([]domain.ExpenseReport, len(rows))
	for i, row := range rows {
		rpt := reportFromRow(row)
		result[i] = *rpt
	}
	return result, nil
}

func (r *reportRepo) ListPayable(ctx context.Context, tenantID uuid.UUID, params domain.WorkflowListParams) ([]domain.ExpenseReport, int, error) {
	q := queries(ctx, r.pool)

	// PerPage のデフォルト・上限を設定する。
	perPage := params.PerPage
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	var applicantNameParam pgtype.Text
	if params.ApplicantName != nil {
		applicantNameParam = pgtype.Text{String: *params.ApplicantName, Valid: true}
	}

	rows, err := q.ListPayableReports(ctx, sqlcgen.ListPayableReportsParams{
		TenantID:      tenantID,
		Limit:         int32(perPage),
		Offset:        int32(offset),
		ApplicantName: applicantNameParam,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.ListPayable: %w", err)
	}

	total, err := q.CountPayableReports(ctx, sqlcgen.CountPayableReportsParams{
		TenantID:      tenantID,
		ApplicantName: applicantNameParam,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("reportRepo.ListPayable (count): %w", err)
	}

	result := make([]domain.ExpenseReport, len(rows))
	for i, row := range rows {
		rpt := reportFromRow(row)
		result[i] = *rpt
	}
	return result, int(total), nil
}
