// 成功レスポンス（単一リソース）
export interface ApiResponse<T> {
  data: T;
}

// 成功レスポンス（一覧、オフセットベースページネーション）
export interface ApiListResponse<T> {
  data: T[];
  pagination: Pagination;
}

// エラーレスポンス
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// 認証トークンペア（AuthTokens スキーマ: POST /api/auth/login, /api/auth/refresh のレスポンスデータ）
export interface AuthTokens {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'approver' | 'member' | 'accounting';
  };
  tenant: {
    id: string;
    name: string;
  };
  access_token: string;
  refresh_token: string;
}

// ユーザー情報（UserProfile スキーマ: GET /api/auth/me のレスポンスデータ）
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'approver' | 'member' | 'accounting';
  tenant: {
    id: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'approver' | 'member' | 'accounting';

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

export type MimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

export interface UserSummary {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  code: string;
  name_ja: string;
  sort_order: number;
}

export interface Pagination {
  current_page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  checks: {
    database: 'ok' | 'error';
  };
}

// ---------------------------------------------------------------------------
// テナント
// ---------------------------------------------------------------------------

export interface TenantInfo {
  id: string;
  name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 経費レポート
// ---------------------------------------------------------------------------

export interface Attachment {
  id: string;
  item_id: string;
  file_name: string;
  file_size: number;
  mime_type: MimeType;
  created_at: string;
}

export interface AttachmentDownload {
  download_url: string;
  file_name: string;
  mime_type: MimeType;
  file_size: number;
  expires_at: string;
}

export interface ExpenseItem {
  id: string;
  report_id: string;
  expense_date: string;
  amount: number;
  category: Category;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItemWithAttachments extends ExpenseItem {
  attachments: Attachment[];
}

export interface ExpenseReportSummary {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  total_amount: number;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  submitter?: UserSummary;
}

export interface ExpenseReportDetail {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  total_amount: number;
  submitter: UserSummary;
  reference_report_id?: string;
  submitted_at?: string;
  submitted_by?: UserSummary;
  approved_at?: string;
  approved_by?: UserSummary;
  approval_comment?: string;
  rejected_at?: string;
  rejected_by?: UserSummary;
  rejection_reason?: string;
  paid_at?: string;
  paid_by?: UserSummary;
  items: ExpenseItemWithAttachments[];
  created_at: string;
  updated_at: string;
}

// リクエスト型

export interface ExpenseReportCreateRequest {
  title: string;
  period_start: string;
  period_end: string;
  reference_report_id?: string;
}

export interface ExpenseReportUpdateRequest {
  title: string;
  period_start: string;
  period_end: string;
  updated_at: string;
}

export interface ExpenseItemCreateRequest {
  expense_date: string;
  amount: number;
  category_id: string;
  description: string;
}

export interface ExpenseItemUpdateRequest {
  expense_date: string;
  amount: number;
  category_id: string;
  description: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// ワークフロー
// ---------------------------------------------------------------------------

export interface PendingReport {
  id: string;
  title: string;
  total_amount: number;
  submitted_at: string;
  submitter: UserSummary;
  is_own_report: boolean;
}

export interface PayableReport {
  id: string;
  title: string;
  total_amount: number;
  approved_at: string;
  submitter: UserSummary;
  is_own_report: boolean;
}

export interface RejectRequest {
  reason: string;
  updated_at: string;
}

export interface ApproveRequest {
  comment?: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// ダッシュボード
// ---------------------------------------------------------------------------

export interface MonthlySummary {
  year_month: string;
  total_amount: number;
}

export interface RecentReport {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: ReportStatus;
  updated_at: string;
}

export interface DashboardResponse {
  my_draft_count?: number;
  my_submitted_count?: number;
  my_rejected_count?: number;
  recent_reports?: RecentReport[];
  pending_approval_count?: number;
  pending_payment_count?: number;
  monthly_summary?: MonthlySummary[];
  tenant_draft_count?: number;
  tenant_submitted_count?: number;
  tenant_approved_count?: number;
  tenant_rejected_count?: number;
  tenant_paid_count?: number;
  tenant_member_count?: number;
}
