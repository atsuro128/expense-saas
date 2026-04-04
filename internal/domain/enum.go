package domain

// ReportStatus は経費精算レポートのライフサイクル上のステータスを表す。
type ReportStatus string

const (
	ReportStatusDraft     ReportStatus = "draft"
	ReportStatusSubmitted ReportStatus = "submitted"
	ReportStatusApproved  ReportStatus = "approved"
	ReportStatusRejected  ReportStatus = "rejected"
	ReportStatusPaid      ReportStatus = "paid"
)

// IsValid はステータスが定義済みの値であれば true を返す。
func (s ReportStatus) IsValid() bool {
	switch s {
	case ReportStatusDraft, ReportStatusSubmitted, ReportStatusApproved, ReportStatusRejected, ReportStatusPaid:
		return true
	}
	return false
}

// Role はテナント内のユーザーの RBAC ロールを表す。
type Role string

const (
	RoleAdmin      Role = "admin"
	RoleApprover   Role = "approver"
	RoleMember     Role = "member"
	RoleAccounting Role = "accounting"
)

// IsValid はロールが定義済みの値であれば true を返す。
func (r Role) IsValid() bool {
	switch r {
	case RoleAdmin, RoleApprover, RoleMember, RoleAccounting:
		return true
	}
	return false
}

// MimeType は添付ファイルとして許可された MIME タイプを表す。
type MimeType string

const (
	MimeTypeImageJpeg      MimeType = "image/jpeg"
	MimeTypeImagePng       MimeType = "image/png"
	MimeTypeApplicationPDF MimeType = "application/pdf"
)

// IsValid は MIME タイプが許可された値であれば true を返す。
func (m MimeType) IsValid() bool {
	switch m {
	case MimeTypeImageJpeg, MimeTypeImagePng, MimeTypeApplicationPDF:
		return true
	}
	return false
}
