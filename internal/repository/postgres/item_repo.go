package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/repository/postgres/sqlcgen"
)

type itemRepo struct {
	pool *pgxpool.Pool
}

// NewItemRepo は PostgreSQL をバックエンドとする ItemRepository を生成して返す。
func NewItemRepo(pool *pgxpool.Pool) domain.ItemRepository {
	return &itemRepo{pool: pool}
}

func (r *itemRepo) Create(
	ctx context.Context,
	tenantID, reportID uuid.UUID,
	expenseDate time.Time,
	amount int,
	categoryID uuid.UUID,
	description string,
) (*domain.ExpenseItem, error) {
	q := queries(ctx, r.pool)
	row, err := q.CreateExpenseItem(ctx, sqlcgen.CreateExpenseItemParams{
		ReportID:    reportID,
		TenantID:    tenantID,
		ExpenseDate: toPgtypeDate(expenseDate),
		Amount:      int32(amount),
		CategoryID:  categoryID,
		Description: description,
	})
	if err != nil {
		return nil, fmt.Errorf("itemRepo.Create: %w", err)
	}
	// 挿入後にレポート合計金額を再計算する。
	if err := q.UpdateReportTotalAmount(ctx, sqlcgen.UpdateReportTotalAmountParams{
		TenantID: tenantID,
		ReportID: reportID,
	}); err != nil {
		return nil, fmt.Errorf("itemRepo.Create (update total): %w", err)
	}
	return itemFromRow(row), nil
}

func (r *itemRepo) GetByID(ctx context.Context, tenantID, reportID, itemID uuid.UUID) (*domain.ExpenseItem, error) {
	q := queries(ctx, r.pool)
	row, err := q.GetExpenseItemByID(ctx, sqlcgen.GetExpenseItemByIDParams{
		TenantID: tenantID,
		ReportID: reportID,
		ItemID:   itemID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrResourceNotFound
		}
		return nil, fmt.Errorf("itemRepo.GetByID: %w", err)
	}
	return itemFromRow(row), nil
}

func (r *itemRepo) ListByReportID(ctx context.Context, tenantID, reportID uuid.UUID) ([]domain.ExpenseItem, error) {
	q := queries(ctx, r.pool)
	rows, err := q.ListExpenseItemsByReportID(ctx, sqlcgen.ListExpenseItemsByReportIDParams{
		TenantID: tenantID,
		ReportID: reportID,
	})
	if err != nil {
		return nil, fmt.Errorf("itemRepo.ListByReportID: %w", err)
	}
	result := make([]domain.ExpenseItem, len(rows))
	for i, row := range rows {
		item := itemFromRow(row)
		result[i] = *item
	}
	return result, nil
}

func (r *itemRepo) Update(ctx context.Context, item *domain.ExpenseItem) error {
	q := queries(ctx, r.pool)
	updated, err := q.UpdateExpenseItem(ctx, sqlcgen.UpdateExpenseItemParams{
		TenantID:    item.TenantID,
		ReportID:    item.ReportID,
		ItemID:      item.ItemID,
		ExpenseDate: toPgtypeDate(item.ExpenseDate),
		Amount:      int32(item.Amount),
		CategoryID:  item.CategoryID,
		Description: item.Description,
		UpdatedAt:   item.UpdatedAt,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// ErrNoRows はアイテムが存在しないか、楽観ロックが失敗したことを意味する。
			return domain.ErrConflict
		}
		return fmt.Errorf("itemRepo.Update: %w", err)
	}
	// 更新後の状態を引数のエンティティに反映する。
	*item = *itemFromRow(updated)
	// 更新後にレポート合計金額を再計算する。
	if err := q.UpdateReportTotalAmount(ctx, sqlcgen.UpdateReportTotalAmountParams{
		TenantID: item.TenantID,
		ReportID: item.ReportID,
	}); err != nil {
		return fmt.Errorf("itemRepo.Update (update total): %w", err)
	}
	return nil
}

func (r *itemRepo) SoftDelete(ctx context.Context, tenantID, reportID, itemID uuid.UUID) error {
	q := queries(ctx, r.pool)
	// このアイテムに紐づく添付ファイルを論理削除する。
	if err := q.SoftDeleteAttachmentsByItemID(ctx, sqlcgen.SoftDeleteAttachmentsByItemIDParams{
		TenantID: tenantID,
		ReportID: reportID,
		ItemID:   itemID,
	}); err != nil {
		return fmt.Errorf("itemRepo.SoftDelete (attachments): %w", err)
	}
	if err := q.SoftDeleteExpenseItem(ctx, sqlcgen.SoftDeleteExpenseItemParams{
		TenantID: tenantID,
		ReportID: reportID,
		ItemID:   itemID,
	}); err != nil {
		return fmt.Errorf("itemRepo.SoftDelete: %w", err)
	}
	// 削除後にレポート合計金額を再計算する。
	if err := q.UpdateReportTotalAmount(ctx, sqlcgen.UpdateReportTotalAmountParams{
		TenantID: tenantID,
		ReportID: reportID,
	}); err != nil {
		return fmt.Errorf("itemRepo.SoftDelete (update total): %w", err)
	}
	return nil
}
