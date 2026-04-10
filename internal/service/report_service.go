package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type reportService struct {
	reportRepo     domain.ReportRepository
	userRepo       domain.UserRepository
	membershipRepo domain.MembershipRepository
	itemRepo       domain.ItemRepository
	categoryRepo   domain.CategoryRepository
	attachmentRepo domain.AttachmentRepository
	authorizer     Authorizer
}

// NewReportService は ReportService を生成して返す。
func NewReportService(
	reportRepo domain.ReportRepository,
	userRepo domain.UserRepository,
	membershipRepo domain.MembershipRepository,
	itemRepo domain.ItemRepository,
	categoryRepo domain.CategoryRepository,
	attachmentRepo domain.AttachmentRepository,
	authorizer Authorizer,
) ReportService {
	return &reportService{
		reportRepo:     reportRepo,
		userRepo:       userRepo,
		membershipRepo: membershipRepo,
		itemRepo:       itemRepo,
		categoryRepo:   categoryRepo,
		attachmentRepo: attachmentRepo,
		authorizer:     authorizer,
	}
}

// CreateReport は操作者が所有する新規経費レポートを作成する。
// reference_report_id が指定されている場合は再申請として扱い、参照元の明細をコピーする。
// 参照元は rejected 状態でなければならない。
func (s *reportService) CreateReport(ctx context.Context, actor domain.Actor, params CreateReportParams) (*domain.ExpenseReportDetail, error) {
	// 再申請の場合は参照元レポートを検証する。
	if params.ReferenceReportID != nil {
		refReport, err := s.reportRepo.GetByID(ctx, actor.TenantID, *params.ReferenceReportID)
		if err != nil {
			return nil, err
		}
		// UC-M09: 自分の却下レポートのみ再申請できる。他ユーザーのレポートは参照不可。
		if refReport.UserID != actor.UserID {
			return nil, domain.ErrForbidden
		}
		if refReport.Status != domain.ReportStatusRejected {
			return nil, domain.ErrInvalidPeriod // VALIDATION_ERROR として扱う
		}
	}

	// 新規レポートを作成する。
	report, err := s.reportRepo.Create(
		ctx,
		actor.TenantID,
		actor.UserID,
		params.Title,
		params.PeriodStart,
		params.PeriodEnd,
		params.ReferenceReportID,
	)
	if err != nil {
		return nil, fmt.Errorf("reportService.CreateReport: %w", err)
	}

	// 再申請の場合は参照元の明細をコピーする（添付ファイルはコピーしない）。
	if params.ReferenceReportID != nil {
		refItems, err := s.itemRepo.ListByReportID(ctx, actor.TenantID, *params.ReferenceReportID)
		if err != nil {
			return nil, fmt.Errorf("reportService.CreateReport (copy items): %w", err)
		}
		for _, item := range refItems {
			_, err := s.itemRepo.Create(
				ctx,
				actor.TenantID,
				report.ReportID,
				item.ExpenseDate,
				item.Amount,
				item.CategoryID,
				item.Description,
			)
			if err != nil {
				return nil, fmt.Errorf("reportService.CreateReport (create item): %w", err)
			}
		}
		// 明細コピー後の最新レポートを取得する（total_amount 更新のため）。
		report, err = s.reportRepo.GetByID(ctx, actor.TenantID, report.ReportID)
		if err != nil {
			return nil, fmt.Errorf("reportService.CreateReport (reload): %w", err)
		}
	}

	return s.buildDetail(ctx, actor, report)
}

// GetReport は単一レポートの詳細を取得する。
func (s *reportService) GetReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID) (*domain.ExpenseReportDetail, error) {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	if err := s.authorizer.CanViewReport(actor, report); err != nil {
		return nil, err
	}

	return s.buildDetail(ctx, actor, report)
}

// ListMyReports は操作者が所有するレポートをページネーション付きで一覧取得する。
func (s *reportService) ListMyReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error) {
	// 自分のレポートに絞り込む。
	params.UserID = &actor.UserID

	reports, total, err := s.reportRepo.List(ctx, actor.TenantID, params)
	if err != nil {
		return nil, nil, fmt.Errorf("reportService.ListMyReports: %w", err)
	}

	summaries := make([]domain.ExpenseReportSummary, len(reports))
	for i, r := range reports {
		summaries[i] = toSummary(r)
	}

	pagination := buildPagination(total, params.Page, params.PerPage)
	return summaries, pagination, nil
}

// ListAllReports はテナント内の全レポートを一覧取得する（Admin / Accounting 専用）。
func (s *reportService) ListAllReports(ctx context.Context, actor domain.Actor, params domain.ReportListParams) ([]domain.ExpenseReportSummary, *domain.Pagination, error) {
	// PerPage のデフォルト値を設定する。
	if params.PerPage <= 0 {
		params.PerPage = 20
	}
	if params.PerPage > 100 {
		params.PerPage = 100
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	reports, total, err := s.reportRepo.List(ctx, actor.TenantID, params)
	if err != nil {
		return nil, nil, fmt.Errorf("reportService.ListAllReports: %w", err)
	}

	// Submitter 情報を付与するためユーザーキャッシュを構築する。
	userCache := make(map[uuid.UUID]domain.UserSummary)

	summaries := make([]domain.ExpenseReportSummary, len(reports))
	for i, r := range reports {
		sum := toSummary(r)
		// Submitter 情報を取得・キャッシュする。
		if _, ok := userCache[r.UserID]; !ok {
			user, err := s.userRepo.GetByID(ctx, r.UserID)
			if err == nil {
				userCache[r.UserID] = domain.UserSummary{ID: user.UserID, Name: user.Name}
			}
		}
		if submitter, ok := userCache[r.UserID]; ok {
			sum.Submitter = &submitter
		}
		summaries[i] = sum
	}

	pagination := buildPagination(total, params.Page, params.PerPage)
	return summaries, pagination, nil
}

// UpdateReport は下書きレポートの変更可能フィールドを更新する。
// 楽観的ロック: params.UpdatedAt と DB の updated_at が一致しない場合は ErrConflict を返す。
func (s *reportService) UpdateReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, params UpdateReportParams) (*domain.ExpenseReportDetail, error) {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 所有者チェック。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return nil, err
	}

	// 編集可能状態チェック。
	if err := report.CanEdit(); err != nil {
		return nil, err
	}

	// 楽観的ロックチェック: params.UpdatedAt を DB の updated_at と比較する。
	// Report.UpdatedAt には DB の値が入っており、params.UpdatedAt はクライアントから送られた値。
	// これらが一致しない場合は競合とみなす。
	if !report.UpdatedAt.Equal(params.UpdatedAt) {
		slog.Error("DEBUG optimistic lock mismatch",
			"db_updated_at", report.UpdatedAt.Format(time.RFC3339Nano),
			"db_unix_nano", report.UpdatedAt.UnixNano(),
			"param_updated_at", params.UpdatedAt.Format(time.RFC3339Nano),
			"param_unix_nano", params.UpdatedAt.UnixNano(),
		)
		return nil, domain.ErrConflict
	}

	// フィールドを更新する。
	report.Title = params.Title
	report.PeriodStart = params.PeriodStart
	report.PeriodEnd = params.PeriodEnd
	report.UpdatedAt = time.Now().UTC()

	if err := s.reportRepo.Update(ctx, report); err != nil {
		return nil, err
	}

	return s.buildDetail(ctx, actor, report)
}

// DeleteReport は下書きレポートを論理削除する。
func (s *reportService) DeleteReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID) error {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return err
	}

	// 所有者チェック。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return err
	}

	// 削除可能状態チェック（ドメイン層で検証）。
	if err := report.Delete(); err != nil {
		return err
	}

	return s.reportRepo.SoftDelete(ctx, actor.TenantID, reportID)
}

// SubmitReport は下書きレポートを提出済みステータスへ遷移させる。
func (s *reportService) SubmitReport(ctx context.Context, actor domain.Actor, reportID uuid.UUID, updatedAt time.Time) (*domain.ExpenseReportDetail, error) {
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 所有者チェック。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return nil, err
	}

	// 楽観的ロックチェック。
	if !report.UpdatedAt.Equal(updatedAt) {
		return nil, domain.ErrConflict
	}

	// テナントに承認者が存在するか確認する。
	hasApprover, err := s.membershipRepo.HasApprover(ctx, actor.TenantID)
	if err != nil {
		return nil, fmt.Errorf("reportService.SubmitReport (check approver): %w", err)
	}

	// 明細を取得する。
	items, err := s.itemRepo.ListByReportID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, fmt.Errorf("reportService.SubmitReport (list items): %w", err)
	}

	// ドメイン層で状態遷移を実行する。
	if err := report.Submit(actor.UserID, items, hasApprover); err != nil {
		return nil, err
	}

	// DB に状態変更を保存する。
	report.UpdatedAt = time.Now().UTC()
	if err := s.reportRepo.UpdateStatus(ctx, report); err != nil {
		return nil, err
	}

	return s.buildDetail(ctx, actor, report)
}

// --- プライベートヘルパー ---

// buildDetail はレポートエンティティから ExpenseReportDetail を構築する。
// 明細・添付ファイル・ユーザー情報を含む完全な表現を返す。
func (s *reportService) buildDetail(ctx context.Context, actor domain.Actor, report *domain.ExpenseReport) (*domain.ExpenseReportDetail, error) {
	// 提出者情報を取得する。
	submitter, err := s.userRepo.GetByID(ctx, report.UserID)
	if err != nil {
		return nil, fmt.Errorf("reportService.buildDetail (submitter): %w", err)
	}

	detail := &domain.ExpenseReportDetail{
		ID:                report.ReportID,
		Title:             report.Title,
		PeriodStart:       report.PeriodStart,
		PeriodEnd:         report.PeriodEnd,
		Status:            report.Status,
		TotalAmount:       report.TotalAmount,
		Submitter:         domain.UserSummary{ID: submitter.UserID, Name: submitter.Name},
		ReferenceReportID: report.ReferenceReportID,
		SubmittedAt:       report.SubmittedAt,
		ApprovedAt:        report.ApprovedAt,
		ApprovalComment:   report.ApprovalComment,
		RejectedAt:        report.RejectedAt,
		RejectionReason:   report.RejectionReason,
		PaidAt:            report.PaidAt,
		CreatedAt:         report.CreatedAt,
		UpdatedAt:         report.UpdatedAt,
	}

	// SubmittedBy ユーザー情報を解決する。
	if report.SubmittedBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.SubmittedBy)
		if err == nil {
			us := domain.UserSummary{ID: u.UserID, Name: u.Name}
			detail.SubmittedBy = &us
		}
	}

	// ApprovedBy ユーザー情報を解決する。
	if report.ApprovedBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.ApprovedBy)
		if err == nil {
			us := domain.UserSummary{ID: u.UserID, Name: u.Name}
			detail.ApprovedBy = &us
		}
	}

	// RejectedBy ユーザー情報を解決する。
	if report.RejectedBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.RejectedBy)
		if err == nil {
			us := domain.UserSummary{ID: u.UserID, Name: u.Name}
			detail.RejectedBy = &us
		}
	}

	// PaidBy ユーザー情報を解決する。
	if report.PaidBy != nil {
		u, err := s.userRepo.GetByID(ctx, *report.PaidBy)
		if err == nil {
			us := domain.UserSummary{ID: u.UserID, Name: u.Name}
			detail.PaidBy = &us
		}
	}

	// 明細を取得する。
	items, err := s.itemRepo.ListByReportID(ctx, actor.TenantID, report.ReportID)
	if err != nil {
		return nil, fmt.Errorf("reportService.buildDetail (items): %w", err)
	}

	// カテゴリキャッシュを構築する。
	categoryCache := make(map[uuid.UUID]domain.CategoryDTO)

	itemDTOs := make([]domain.ExpenseItemDTO, len(items))
	for i, item := range items {
		// カテゴリ情報を解決する。
		if _, ok := categoryCache[item.CategoryID]; !ok {
			cat, err := s.categoryRepo.GetByID(ctx, actor.TenantID, item.CategoryID)
			if err == nil {
				categoryCache[item.CategoryID] = domain.CategoryDTO{
					ID:        cat.CategoryID,
					Code:      cat.Code,
					NameJa:    cat.NameJa,
					SortOrder: cat.SortOrder,
				}
			}
		}

		catDTO := categoryCache[item.CategoryID]

		// 添付ファイルを取得する。
		attachments, err := s.attachmentRepo.ListByItemID(ctx, actor.TenantID, report.ReportID, item.ItemID)
		if err != nil {
			return nil, fmt.Errorf("reportService.buildDetail (attachments): %w", err)
		}

		attDTOs := make([]domain.AttachmentDTO, len(attachments))
		for j, att := range attachments {
			attDTOs[j] = domain.AttachmentDTO{
				ID:        att.AttachmentID,
				ItemID:    att.ItemID,
				FileName:  att.FileName,
				FileSize:  att.FileSize,
				MimeType:  att.MimeType,
				CreatedAt: att.CreatedAt,
			}
		}

		itemDTOs[i] = domain.ExpenseItemDTO{
			ID:          item.ItemID,
			ReportID:    item.ReportID,
			ExpenseDate: item.ExpenseDate,
			Amount:      item.Amount,
			Category:    catDTO,
			Description: item.Description,
			Attachments: attDTOs,
			CreatedAt:   item.CreatedAt,
			UpdatedAt:   item.UpdatedAt,
		}
	}
	detail.Items = itemDTOs

	return detail, nil
}

// toSummary はレポートエンティティから ExpenseReportSummary を構築する。
func toSummary(r domain.ExpenseReport) domain.ExpenseReportSummary {
	return domain.ExpenseReportSummary{
		ID:          r.ReportID,
		Title:       r.Title,
		PeriodStart: r.PeriodStart,
		PeriodEnd:   r.PeriodEnd,
		Status:      r.Status,
		TotalAmount: r.TotalAmount,
		SubmittedAt: r.SubmittedAt,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}

// buildPagination は総件数・ページ番号・1ページあたり件数からページネーション情報を構築する。
func buildPagination(total, page, perPage int) *domain.Pagination {
	if perPage <= 0 {
		perPage = 20
	}
	if page <= 0 {
		page = 1
	}
	totalPages := (total + perPage - 1) / perPage
	if totalPages == 0 {
		totalPages = 1
	}
	return &domain.Pagination{
		CurrentPage: page,
		PerPage:     perPage,
		TotalCount:  total,
		TotalPages:  totalPages,
	}
}
