-- name: CreateTenant :one
INSERT INTO tenants (company_name)
VALUES ($1)
RETURNING *;

-- name: GetTenantByID :one
SELECT * FROM tenants
WHERE tenant_id = $1;
