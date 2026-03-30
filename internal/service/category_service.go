package service

import (
	"context"

	"expense-saas/internal/domain"
)

type categoryService struct {
	categoryRepo domain.CategoryRepository
}

// NewCategoryService constructs a CategoryService.
func NewCategoryService(categoryRepo domain.CategoryRepository) CategoryService {
	return &categoryService{categoryRepo: categoryRepo}
}

func (s *categoryService) ListCategories(_ context.Context, _ domain.Actor) ([]domain.CategoryDTO, error) {
	return nil, ErrNotImplemented
}
