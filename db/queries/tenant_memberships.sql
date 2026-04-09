-- name: CreateMembership :one
INSERT INTO tenant_memberships (tenant_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetMembershipByUserID :one
SELECT * FROM tenant_memberships
WHERE user_id = $1;

-- name: ListMembershipsByTenantID :many
SELECT * FROM tenant_memberships
WHERE tenant_id = $1
ORDER BY created_at ASC;

-- name: HasApprover :one
SELECT EXISTS(
    SELECT 1 FROM tenant_memberships
    WHERE tenant_id = $1
      AND role = 'approver'
) AS has_approver;

-- name: CountMembersByTenantID :one
SELECT COUNT(*)::int FROM tenant_memberships WHERE tenant_id = $1;
