package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type itemService struct {
	reportRepo     domain.ReportRepository
	itemRepo       domain.ItemRepository
	categoryRepo   domain.CategoryRepository
	attachmentRepo domain.AttachmentRepository
	authorizer     Authorizer
}

// NewItemService は ItemService を生成して返す。
func NewItemService(
	reportRepo domain.ReportRepository,
	itemRepo domain.ItemRepository,
	categoryRepo domain.CategoryRepository,
	attachmentRepo domain.AttachmentRepository,
	authorizer Authorizer,
) ItemService {
	return &itemService{
		reportRepo:     reportRepo,
		itemRepo:       itemRepo,
		categoryRepo:   categoryRepo,
		attachmentRepo: attachmentRepo,
		authorizer:     authorizer,
	}
}

// CreateItem は下書きレポートに新規経費明細を作成する。
//
// 処理手順:
//  1. レポート取得（存在しない場合は ErrResourceNotFound）
//  2. 所有権チェック（操作者以外は ErrForbidden）
//  3. 編集可能状態チェック（draft 以外は ErrReportNotEditable）
//  4. 金額バリデーション（0 以下は ErrInvalidAmount）
//  5. カテゴリ存在チェック（存在しない場合は ErrResourceNotFound）
//  6. 明細を永続化して DTO を返す
func (s *itemService) CreateItem(ctx context.Context, actor domain.Actor, reportID uuid.UUID, params CreateItemParams) (*domain.ExpenseItemDTO, error) {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 所有権チェック。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return nil, err
	}

	// 編集可能状態チェック（draft のみ編集可）。
	if err := report.CanEdit(); err != nil {
		return nil, err
	}

	// 金額バリデーション。
	tmpItem := &domain.ExpenseItem{Amount: params.Amount}
	if err := tmpItem.ValidateAmount(); err != nil {
		return nil, err
	}

	// カテゴリ存在チェック。
	if _, err := s.categoryRepo.GetByID(ctx, actor.TenantID, params.CategoryID); err != nil {
		return nil, err
	}

	// 明細を永続化する（リポジトリ内で合計金額を再計算する）。
	created, err := s.itemRepo.Create(
		ctx,
		actor.TenantID,
		reportID,
		params.ExpenseDate,
		params.Amount,
		params.CategoryID,
		params.Description,
	)
	if err != nil {
		return nil, fmt.Errorf("itemService.CreateItem: %w", err)
	}

	return s.buildItemDTO(ctx, actor, created)
}

// UpdateItem は下書きレポートの経費明細を更新する。
//
// 処理手順:
//  1. レポート取得 → 所有権チェック → 編集可能状態チェック
//  2. 明細取得（存在しない場合は ErrResourceNotFound）
//  3. 金額バリデーション
//  4. カテゴリ存在チェック
//  5. 明細フィールドを更新して楽観的ロック付きで永続化
//  6. DTO を返す
func (s *itemService) UpdateItem(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID, params UpdateItemParams) (*domain.ExpenseItemDTO, error) {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return nil, err
	}

	// 所有権チェック。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return nil, err
	}

	// 編集可能状態チェック（draft のみ編集可）。
	if err := report.CanEdit(); err != nil {
		return nil, err
	}

	// 明細を取得する。
	item, err := s.itemRepo.GetByID(ctx, actor.TenantID, reportID, itemID)
	if err != nil {
		return nil, err
	}

	// 金額バリデーション。
	item.Amount = params.Amount
	if err := item.ValidateAmount(); err != nil {
		return nil, err
	}

	// カテゴリ存在チェック。
	if _, err := s.categoryRepo.GetByID(ctx, actor.TenantID, params.CategoryID); err != nil {
		return nil, err
	}

	// 明細フィールドを更新する。
	item.ExpenseDate = params.ExpenseDate
	item.CategoryID = params.CategoryID
	item.Description = params.Description
	item.UpdatedAt = params.UpdatedAt

	// 楽観的ロック付きで永続化する（リポジトリ内で合計金額を再計算する）。
	if err := s.itemRepo.Update(ctx, item); err != nil {
		return nil, err
	}

	return s.buildItemDTO(ctx, actor, item)
}

// DeleteItem は下書きレポートの経費明細を論理削除する。
//
// 処理手順:
//  1. レポート取得 → 所有権チェック → 編集可能状態チェック
//  2. 明細取得（存在しない場合は ErrResourceNotFound）
//  3. 明細を論理削除する（添付ファイル連動削除 + 合計金額再計算はリポジトリ内）
func (s *itemService) DeleteItem(ctx context.Context, actor domain.Actor, reportID, itemID uuid.UUID) error {
	// レポートを取得する。
	report, err := s.reportRepo.GetByID(ctx, actor.TenantID, reportID)
	if err != nil {
		return err
	}

	// 所有権チェック。
	if err := s.authorizer.CanModifyReport(actor, report); err != nil {
		return err
	}

	// 編集可能状態チェック（draft のみ編集可）。
	if err := report.CanEdit(); err != nil {
		return err
	}

	// 明細存在チェック。
	if _, err := s.itemRepo.GetByID(ctx, actor.TenantID, reportID, itemID); err != nil {
		return err
	}

	// 明細を論理削除する（添付ファイル連動削除 + 合計金額再計算はリポジトリ内）。
	return s.itemRepo.SoftDelete(ctx, actor.TenantID, reportID, itemID)
}

// buildItemDTO は ExpenseItem エンティティから ExpenseItemDTO を構築する。
// カテゴリ情報・添付ファイル情報を付加する。
// 添付ファイルがない場合は null ではなく空スライスを設定する（FE の .length アクセスに対応）。
func (s *itemService) buildItemDTO(ctx context.Context, actor domain.Actor, item *domain.ExpenseItem) (*domain.ExpenseItemDTO, error) {
	// カテゴリ情報を取得する。
	cat, err := s.categoryRepo.GetByID(ctx, actor.TenantID, item.CategoryID)
	if err != nil {
		return nil, fmt.Errorf("itemService.buildItemDTO (category): %w", err)
	}
	catDTO := domain.CategoryDTO{
		ID:        cat.CategoryID,
		Code:      cat.Code,
		NameJa:    cat.NameJa,
		SortOrder: cat.SortOrder,
	}

	// 添付ファイル情報を取得する。
	attachments, err := s.attachmentRepo.ListByItemID(ctx, actor.TenantID, item.ReportID, item.ItemID)
	if err != nil {
		return nil, fmt.Errorf("itemService.buildItemDTO (attachments): %w", err)
	}

	// 添付ファイルがない場合も null ではなく空スライスを設定する。
	attDTOs := make([]domain.AttachmentDTO, len(attachments))
	for i, att := range attachments {
		attDTOs[i] = domain.AttachmentDTO{
			ID:        att.AttachmentID,
			ItemID:    att.ItemID,
			FileName:  att.FileName,
			FileSize:  att.FileSize,
			MimeType:  att.MimeType,
			CreatedAt: att.CreatedAt,
		}
	}

	return &domain.ExpenseItemDTO{
		ID:          item.ItemID,
		ReportID:    item.ReportID,
		ExpenseDate: item.ExpenseDate,
		Amount:      item.Amount,
		Category:    catDTO,
		Description: item.Description,
		Attachments: attDTOs,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}, nil
}
