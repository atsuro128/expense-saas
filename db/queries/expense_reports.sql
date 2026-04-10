-- name: CreateReport :one
INSERT INTO expense_reports (tenant_id, user_id, title, period_start, period_end, reference_report_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetReportByID :one
SELECT * FROM expense_reports
WHERE tenant_id  = $1
  AND report_id  = $2
  AND deleted_at IS NULL;

-- name: ListReportsByUser :many
SELECT * FROM expense_reports
WHERE tenant_id = $1
  AND user_id   = $2
  AND deleted_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('from_date')::date IS NULL OR period_start >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date')::date IS NULL OR period_end <= sqlc.narg('to_date'))
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountReportsByUser :one
SELECT COUNT(*)::int FROM expense_reports
WHERE tenant_id = $1
  AND user_id   = $2
  AND deleted_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('from_date')::date IS NULL OR period_start >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date')::date IS NULL OR period_end <= sqlc.narg('to_date'));

-- name: ListAllReports :many
SELECT * FROM expense_reports
WHERE tenant_id  = $1
  AND deleted_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('from_date')::date IS NULL OR period_start >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date')::date IS NULL OR period_end <= sqlc.narg('to_date'))
  AND (sqlc.narg('user_id')::uuid IS NULL OR user_id = sqlc.narg('user_id'))
ORDER BY submitted_at DESC NULLS LAST, created_at DESC, report_id DESC
LIMIT $2 OFFSET $3;

-- name: CountAllReports :one
SELECT COUNT(*)::int FROM expense_reports
WHERE tenant_id  = $1
  AND deleted_at IS NULL
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
  AND (sqlc.narg('from_date')::date IS NULL OR period_start >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date')::date IS NULL OR period_end <= sqlc.narg('to_date'))
  AND (sqlc.narg('user_id')::uuid IS NULL OR user_id = sqlc.narg('user_id'));

-- name: UpdateReport :one
UPDATE expense_reports
SET title        = $3,
    period_start = $4,
    period_end   = $5,
    updated_at   = now()
WHERE tenant_id  = $1
  AND report_id  = $2
  AND deleted_at IS NULL
  AND updated_at = $6
RETURNING *;

-- name: UpdateReportStatus :one
UPDATE expense_reports
SET status           = $3,
    submitted_by     = $4,
    submitted_at     = $5,
    approved_by      = $6,
    approved_at      = $7,
    approval_comment = $8,
    rejected_by      = $9,
    rejected_at      = $10,
    rejection_reason = $11,
    paid_by          = $12,
    paid_at          = $13,
    updated_at       = now()
WHERE tenant_id  = $1
  AND report_id  = $2
  AND deleted_at IS NULL
  AND updated_at = $14
RETURNING *;

-- name: SoftDeleteReport :exec
UPDATE expense_reports
SET deleted_at = now(),
    updated_at = now()
WHERE tenant_id = $1
  AND report_id = $2
  AND deleted_at IS NULL;

-- name: ListPendingReports :many
SELECT er.report_id, er.tenant_id, er.user_id, er.title, er.period_start, er.period_end, er.status, er.total_amount, er.reference_report_id, er.submitted_by, er.submitted_at, er.approved_by, er.approved_at, er.approval_comment, er.rejected_by, er.rejected_at, er.rejection_reason, er.paid_by, er.paid_at, er.created_at, er.updated_at, er.deleted_at
FROM expense_reports er
JOIN users u ON er.user_id = u.user_id
WHERE er.tenant_id  = $1
  AND er.status     = 'submitted'
  AND er.deleted_at IS NULL
  AND (sqlc.narg('applicant_name')::text IS NULL OR u.name ILIKE '%' || sqlc.narg('applicant_name') || '%')
ORDER BY er.submitted_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPendingReports :one
SELECT COUNT(*)::int
FROM expense_reports er
JOIN users u ON er.user_id = u.user_id
WHERE er.tenant_id  = $1
  AND er.status     = 'submitted'
  AND er.deleted_at IS NULL
  AND (sqlc.narg('applicant_name')::text IS NULL OR u.name ILIKE '%' || sqlc.narg('applicant_name') || '%');

-- name: ListPayableReports :many
SELECT er.report_id, er.tenant_id, er.user_id, er.title, er.period_start, er.period_end, er.status, er.total_amount, er.reference_report_id, er.submitted_by, er.submitted_at, er.approved_by, er.approved_at, er.approval_comment, er.rejected_by, er.rejected_at, er.rejection_reason, er.paid_by, er.paid_at, er.created_at, er.updated_at, er.deleted_at
FROM expense_reports er
JOIN users u ON er.user_id = u.user_id
WHERE er.tenant_id  = $1
  AND er.status     = 'approved'
  AND er.deleted_at IS NULL
  AND (sqlc.narg('applicant_name')::text IS NULL OR u.name ILIKE '%' || sqlc.narg('applicant_name') || '%')
ORDER BY er.approved_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPayableReports :one
SELECT COUNT(*)::int
FROM expense_reports er
JOIN users u ON er.user_id = u.user_id
WHERE er.tenant_id  = $1
  AND er.status     = 'approved'
  AND er.deleted_at IS NULL
  AND (sqlc.narg('applicant_name')::text IS NULL OR u.name ILIKE '%' || sqlc.narg('applicant_name') || '%');

-- name: CountReportsByStatus :many
SELECT status, COUNT(*)::int AS count
FROM expense_reports
WHERE tenant_id  = $1
  AND deleted_at IS NULL
GROUP BY status;

-- name: CountMyReportsByStatus :many
SELECT status, COUNT(*)::int AS count
FROM expense_reports
WHERE tenant_id  = $1
  AND user_id    = $2
  AND deleted_at IS NULL
GROUP BY status;

-- name: MonthlySummaryAll :many
SELECT to_char(date_trunc('month', period_start), 'YYYY-MM') AS year_month,
       SUM(total_amount)::int                                 AS total_amount
FROM expense_reports
WHERE tenant_id   = $1
  AND status      = 'paid'
  AND deleted_at  IS NULL
  AND period_start >= date_trunc('month', now()) - ($2::int - 1) * INTERVAL '1 month'
GROUP BY date_trunc('month', period_start)
ORDER BY date_trunc('month', period_start) DESC;

-- name: MonthlySummaryByUser :many
SELECT to_char(date_trunc('month', period_start), 'YYYY-MM') AS year_month,
       SUM(total_amount)::int                                 AS total_amount
FROM expense_reports
WHERE tenant_id   = $1
  AND user_id     = $2
  AND status      = 'paid'
  AND deleted_at  IS NULL
  AND period_start >= date_trunc('month', now()) - ($3::int - 1) * INTERVAL '1 month'
GROUP BY date_trunc('month', period_start)
ORDER BY date_trunc('month', period_start) DESC;

-- name: ListRecentReports :many
SELECT * FROM expense_reports
WHERE tenant_id  = $1
  AND user_id    = $2
  AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT $3;

-- name: UpdateReportTotalAmount :exec
UPDATE expense_reports
SET total_amount = (
    SELECT COALESCE(SUM(ei.amount), 0)
    FROM expense_items ei
    WHERE ei.report_id  = expense_reports.report_id
      AND ei.tenant_id  = expense_reports.tenant_id
      AND ei.deleted_at IS NULL
),
    updated_at = now()
WHERE expense_reports.tenant_id = $1
  AND expense_reports.report_id = $2;
