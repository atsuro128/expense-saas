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

// ListCategories は操作者のテナントで参照可能な有効カテゴリを返す。
func (s *categoryService) ListCategories(ctx context.Context, actor domain.Actor) ([]domain.CategoryDTO, error) {
	categories, err := s.categoryRepo.ListActive(ctx, actor.TenantID)
	if err != nil {
		return nil, err
	}

	result := make([]domain.CategoryDTO, len(categories))
	for i, c := range categories {
		result[i] = domain.CategoryDTO{
			ID:        c.CategoryID,
			Code:      c.Code,
			NameJa:    c.NameJa,
			SortOrder: c.SortOrder,
		}
	}
	return result, nil
}
