-- name: ListActiveCategories :many
SELECT * FROM categories
WHERE is_active = true
  AND (tenant_id IS NULL OR tenant_id = $1)
ORDER BY sort_order ASC;

-- name: GetCategoryByID :one
SELECT * FROM categories
WHERE category_id = $1
  AND is_active = true
  AND (tenant_id = $2 OR tenant_id IS NULL);
