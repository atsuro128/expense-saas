-- name: CreateExpenseItem :one
INSERT INTO expense_items (report_id, tenant_id, expense_date, amount, category_id, description)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetExpenseItemByID :one
SELECT * FROM expense_items
WHERE tenant_id  = $1
  AND report_id  = $2
  AND item_id    = $3
  AND deleted_at IS NULL;

-- name: ListExpenseItemsByReportID :many
SELECT * FROM expense_items
WHERE tenant_id  = $1
  AND report_id  = $2
  AND deleted_at IS NULL
ORDER BY created_at ASC;

-- name: UpdateExpenseItem :one
UPDATE expense_items
SET expense_date = $4,
    amount       = $5,
    category_id  = $6,
    description  = $7,
    updated_at   = now()
WHERE tenant_id  = $1
  AND report_id  = $2
  AND item_id    = $3
  AND deleted_at IS NULL
  AND updated_at = $8
RETURNING *;

-- name: SoftDeleteExpenseItem :exec
UPDATE expense_items
SET deleted_at = now(),
    updated_at = now()
WHERE tenant_id = $1
  AND report_id = $2
  AND item_id   = $3
  AND deleted_at IS NULL;

-- name: SoftDeleteExpenseItemsByReportID :exec
UPDATE expense_items
SET deleted_at = now(),
    updated_at = now()
WHERE tenant_id = $1
  AND report_id = $2
  AND deleted_at IS NULL;

-- name: CountExpenseItemsByReportID :one
SELECT COUNT(*)::int AS count
FROM expense_items
WHERE tenant_id  = $1
  AND report_id  = $2
  AND deleted_at IS NULL;
