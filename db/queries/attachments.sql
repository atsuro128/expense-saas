-- name: CreateAttachment :one
INSERT INTO attachments (attachment_id, item_id, report_id, tenant_id, file_name, file_size, mime_type, s3_key)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetAttachmentByID :one
SELECT * FROM attachments
WHERE tenant_id     = $1
  AND report_id     = $2
  AND item_id       = $3
  AND attachment_id = $4
  AND deleted_at    IS NULL;

-- name: ListAttachmentsByItemID :many
SELECT * FROM attachments
WHERE tenant_id  = $1
  AND report_id  = $2
  AND item_id    = $3
  AND deleted_at IS NULL
ORDER BY created_at ASC;

-- name: SoftDeleteAttachment :exec
UPDATE attachments
SET deleted_at = now()
WHERE tenant_id     = $1
  AND report_id     = $2
  AND item_id       = $3
  AND attachment_id = $4
  AND deleted_at    IS NULL;

-- name: SoftDeleteAttachmentsByItemID :exec
UPDATE attachments
SET deleted_at = now()
WHERE tenant_id  = $1
  AND report_id  = $2
  AND item_id    = $3
  AND deleted_at IS NULL;

-- name: SoftDeleteAttachmentsByReportID :exec
UPDATE attachments
SET deleted_at = now()
WHERE tenant_id  = $1
  AND report_id  = $2
  AND deleted_at IS NULL;
