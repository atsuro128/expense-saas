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

// NewItemRepo constructs an ItemRepository backed by PostgreSQL.
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
	// Recalculate report total after insertion.
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
			// ErrNoRows means either the item doesn't exist or optimistic lock failed.
			return domain.ErrConflict
		}
		return fmt.Errorf("itemRepo.Update: %w", err)
	}
	// Reflect updated state back into the passed entity.
	*item = *itemFromRow(updated)
	// Recalculate report total after update.
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
	// Soft-delete attachments belonging to this item.
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
	// Recalculate report total after deletion.
	if err := q.UpdateReportTotalAmount(ctx, sqlcgen.UpdateReportTotalAmountParams{
		TenantID: tenantID,
		ReportID: reportID,
	}); err != nil {
		return fmt.Errorf("itemRepo.SoftDelete (update total): %w", err)
	}
	return nil
}
