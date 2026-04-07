package service

import (
	"context"

	"expense-saas/internal/domain"
)

type categoryService struct {
	categoryRepo domain.CategoryRepository
}

// NewCategoryService は CategoryService を生成して返す。
func NewCategoryService(categoryRepo domain.CategoryRepository) CategoryService {
	return &categoryService{categoryRepo: categoryRepo}
}

func (s *categoryService) ListCategories(_ context.Context, _ domain.Actor) ([]domain.CategoryDTO, error) {
	return nil, ErrNotImplemented
}
