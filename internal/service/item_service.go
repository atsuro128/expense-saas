package service

import (
	"context"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
)

type itemService struct {
	reportRepo   domain.ReportRepository
	itemRepo     domain.ItemRepository
	categoryRepo domain.CategoryRepository
	authorizer   Authorizer
}

// NewItemService constructs an ItemService.
func NewItemService(
	reportRepo domain.ReportRepository,
	itemRepo domain.ItemRepository,
	categoryRepo domain.CategoryRepository,
	authorizer Authorizer,
) ItemService {
	return &itemService{
		reportRepo:   reportRepo,
		itemRepo:     itemRepo,
		categoryRepo: categoryRepo,
		authorizer:   authorizer,
	}
}

func (s *itemService) CreateItem(_ context.Context, _ domain.Actor, _ uuid.UUID, _ CreateItemParams) (*domain.ExpenseItemDTO, error) {
	return nil, ErrNotImplemented
}

func (s *itemService) UpdateItem(_ context.Context, _ domain.Actor, _, _ uuid.UUID, _ UpdateItemParams) (*domain.ExpenseItemDTO, error) {
	return nil, ErrNotImplemented
}

func (s *itemService) DeleteItem(_ context.Context, _ domain.Actor, _, _ uuid.UUID) error {
	return ErrNotImplemented
}
