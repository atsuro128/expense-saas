package domain

// ReportStatus represents the lifecycle status of an expense report.
type ReportStatus string

const (
	ReportStatusDraft     ReportStatus = "draft"
	ReportStatusSubmitted ReportStatus = "submitted"
	ReportStatusApproved  ReportStatus = "approved"
	ReportStatusRejected  ReportStatus = "rejected"
	ReportStatusPaid      ReportStatus = "paid"
)

// IsValid returns true when the status is one of the defined values.
func (s ReportStatus) IsValid() bool {
	switch s {
	case ReportStatusDraft, ReportStatusSubmitted, ReportStatusApproved, ReportStatusRejected, ReportStatusPaid:
		return true
	}
	return false
}

// Role represents the RBAC role of a user within a tenant.
type Role string

const (
	RoleAdmin      Role = "admin"
	RoleApprover   Role = "approver"
	RoleMember     Role = "member"
	RoleAccounting Role = "accounting"
)

// IsValid returns true when the role is one of the defined values.
func (r Role) IsValid() bool {
	switch r {
	case RoleAdmin, RoleApprover, RoleMember, RoleAccounting:
		return true
	}
	return false
}

// MimeType represents an allowed MIME type for attachments.
type MimeType string

const (
	MimeTypeImageJpeg      MimeType = "image/jpeg"
	MimeTypeImagePng       MimeType = "image/png"
	MimeTypeApplicationPDF MimeType = "application/pdf"
)

// IsValid returns true when the MIME type is one of the allowed values.
func (m MimeType) IsValid() bool {
	switch m {
	case MimeTypeImageJpeg, MimeTypeImagePng, MimeTypeApplicationPDF:
		return true
	}
	return false
}
