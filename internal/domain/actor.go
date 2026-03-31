package domain

import "github.com/google/uuid"

// Actor represents an authenticated user acting within a tenant context.
// It is constructed from the validated JWT claims by the Auth middleware.
type Actor struct {
	UserID   uuid.UUID
	TenantID uuid.UUID
	Role     Role
}
