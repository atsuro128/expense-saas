package handler_test

// DSH-001〜DSH-018: ダッシュボード取得エンドポイントの統合テスト。
// GET /api/dashboard のハンドラ（getDashboard）を対象とする。

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// dashboardDateOnlyPattern は YYYY-MM-DD 形式の正規表現。
// issue 117: ダッシュボードの recent_reports における period_start / period_end の形式検証に使用する。
var dashboardDateOnlyPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// assertDashboardDateOnlyFormat は文字列 s が YYYY-MM-DD 形式であり、RFC3339 トークン（T / Z）を含まないことを検証する。
// issue 117 codex 指摘対応: ダッシュボード recent_reports の period_start / period_end 形式検証ヘルパー。
func assertDashboardDateOnlyFormat(t *testing.T, field, s string) {
	t.Helper()
	if !dashboardDateOnlyPattern.MatchString(s) {
		t.Errorf("%s: YYYY-MM-DD 形式ではありません: got %q", field, s)
	}
	if strings.Contains(s, "T") {
		t.Errorf("%s: RFC3339 の 'T' トークンが含まれています: got %q", field, s)
	}
	if strings.Contains(s, "Z") {
		t.Errorf("%s: RFC3339 の 'Z' トークンが含まれています: got %q", field, s)
	}
}

// dashboardResponse は GET /api/dashboard のレスポンスボディ構造。
// ロール別に返却フィールドが異なるため、全フィールドをポインタで定義する。
type dashboardResponse struct {
	Data struct {
		// Member / Approver / Accounting 共通フィールド。
		MyDraftCount     *int `json:"my_draft_count"`
		MySubmittedCount *int `json:"my_submitted_count"`
		MyRejectedCount  *int `json:"my_rejected_count"`
		RecentReports    *[]struct {
			ID          string `json:"id"`
			Title       string `json:"title"`
			PeriodStart string `json:"period_start"`
			PeriodEnd   string `json:"period_end"`
			TotalAmount int    `json:"total_amount"`
			Status      string `json:"status"`
			UpdatedAt   string `json:"updated_at"`
		} `json:"recent_reports"`

		// Approver フィールド。
		PendingApprovalCount *int `json:"pending_approval_count"`

		// Accounting フィールド。
		PendingPaymentCount *int `json:"pending_payment_count"`

		// Approver / Accounting / Admin 共通フィールド。
		MonthlySummary *[]struct {
			YearMonth   string `json:"year_month"`
			TotalAmount int    `json:"total_amount"`
		} `json:"monthly_summary"`

		// Admin フィールド。
		TenantDraftCount     *int `json:"tenant_draft_count"`
		TenantSubmittedCount *int `json:"tenant_submitted_count"`
		TenantApprovedCount  *int `json:"tenant_approved_count"`
		TenantRejectedCount  *int `json:"tenant_rejected_count"`
		TenantPaidCount      *int `json:"tenant_paid_count"`
		TenantMemberCount    *int `json:"tenant_member_count"`
	} `json:"data"`
}

// setupDashboardTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupDashboardTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}

// parseDashboardResponseRaw はレスポンスボディを map[string]interface{} としてパースし、
// "data" キーの値（map）を返す。フィールドの存在確認に使用する。
func parseDashboardResponseRaw(t *testing.T, body []byte) map[string]interface{} {
	t.Helper()
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatalf("JSON パースに失敗しました: %v (body: %s)", err, body)
	}
	data, ok := raw["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("レスポンスに 'data' フィールドがありません (body: %s)", body)
	}
	return data
}

// =============================================================================
// DSH-001〜DSH-002: 認可テスト（未認証 / ロール境界）
// =============================================================================

// TestGetDashboard_Unauthorized_NoToken は認証トークンなしのリクエストが 401 を返すことを検証する。
// DSH-001 に対応する。
func TestGetDashboard_Unauthorized_NoToken(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/dashboard", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}

	rec := srv.Execute(req)
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "UNAUTHORIZED")
}

// TestGetDashboard_Unauthorized_ExpiredToken は期限切れトークンのリクエストが 401 を返すことを検証する。
// DSH-002 に対応する。
func TestGetDashboard_Unauthorized_ExpiredToken(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	// 過去時刻（2時間前）で有効期限切れのアクセストークンを生成する。
	expiredToken := testutil.GenerateExpiredTestToken(t, testutil.UserMemberID, testutil.TenantAID, "member")

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/dashboard", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+expiredToken)

	rec := srv.Execute(req)
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "TOKEN_EXPIRED")
}

// =============================================================================
// DSH-003〜DSH-005: Member ロール — 返却フィールドテスト
// =============================================================================

// TestGetDashboard_Member_CountsMatchFixtures は Member のダッシュボード集計値がフィクスチャと一致することを検証する。
// DSH-003 に対応する。
// フィクスチャ: テナントA に draft × 2、submitted × 1、rejected × 1 が存在する。
func TestGetDashboard_Member_CountsMatchFixtures(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.MyDraftCount == nil {
		t.Fatal("my_draft_count が null です")
	}
	if got, want := *resp.Data.MyDraftCount, 2; got != want {
		t.Errorf("my_draft_count: got %d, want %d", got, want)
	}

	if resp.Data.MySubmittedCount == nil {
		t.Fatal("my_submitted_count が null です")
	}
	if got, want := *resp.Data.MySubmittedCount, 1; got != want {
		t.Errorf("my_submitted_count: got %d, want %d", got, want)
	}

	if resp.Data.MyRejectedCount == nil {
		t.Fatal("my_rejected_count が null です")
	}
	if got, want := *resp.Data.MyRejectedCount, 1; got != want {
		t.Errorf("my_rejected_count: got %d, want %d", got, want)
	}
}

// TestGetDashboard_Member_RecentReports_MaxFive は recent_reports が最大 5 件であることを検証する。
// DSH-004 に対応する。
// フィクスチャ: userMember が 8 件のレポートを保有する（標準フィクスチャ 6 件 + issue-087 追加 paid 2 件）。
func TestGetDashboard_Member_RecentReports_MaxFive(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.RecentReports == nil {
		t.Fatal("recent_reports が null です")
	}
	if got := len(*resp.Data.RecentReports); got > 5 {
		t.Errorf("recent_reports の件数が 5 を超えています: got %d", got)
	}

	// issue 117 codex 指摘: recent_reports の各レポートの period_start / period_end が
	// YYYY-MM-DD 形式であり、RFC3339 トークン（T / Z）を含まないことを検証する。
	for i, r := range *resp.Data.RecentReports {
		assertDashboardDateOnlyFormat(t, fmt.Sprintf("recent_reports[%d].period_start", i), r.PeriodStart)
		assertDashboardDateOnlyFormat(t, fmt.Sprintf("recent_reports[%d].period_end", i), r.PeriodEnd)
	}
}

// TestGetDashboard_Member_NoApproverFields は Member レスポンスに Approver / Admin 専用フィールドが含まれないことを検証する。
// DSH-005 に対応する。
func TestGetDashboard_Member_NoApproverFields(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	// map デコードでキーの有無を検証する。
	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	absentFields := []string{
		"pending_approval_count",
		"pending_payment_count",
		"monthly_summary",
		"tenant_draft_count",
		"tenant_submitted_count",
		"tenant_approved_count",
		"tenant_rejected_count",
		"tenant_paid_count",
		"tenant_member_count",
	}
	for _, field := range absentFields {
		if _, exists := data[field]; exists {
			t.Errorf("Member レスポンスに %q が含まれています（含まれるべきでない）", field)
		}
	}
}

// =============================================================================
// DSH-006〜DSH-009: Approver ロール — 返却フィールドテスト
// =============================================================================

// TestGetDashboard_Approver_MemberFieldsPresent は Approver レスポンスに Member フィールドが含まれることを検証する。
// DSH-006 に対応する。
func TestGetDashboard_Approver_MemberFieldsPresent(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	requiredFields := []string{
		"my_draft_count",
		"my_submitted_count",
		"my_rejected_count",
		"recent_reports",
	}
	for _, field := range requiredFields {
		if _, exists := data[field]; !exists {
			t.Errorf("Approver レスポンスに %q が含まれていません（含まれるべき）", field)
		}
	}
}

// TestGetDashboard_Approver_PendingApprovalCount は Approver の pending_approval_count が正しく返ることを検証する。
// DSH-007 に対応する。
// フィクスチャ: テナントA に userMember 所有の submitted が 1 件存在し、Approver の submitted は 0 件。
func TestGetDashboard_Approver_PendingApprovalCount(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.PendingApprovalCount == nil {
		t.Fatal("pending_approval_count が null です")
	}
	// userMember が 1 件 submitted を持つ（自分のものを除いた件数）。
	if got, want := *resp.Data.PendingApprovalCount, 1; got != want {
		t.Errorf("pending_approval_count: got %d, want %d", got, want)
	}
}

// TestGetDashboard_Approver_PendingApprovalExcludesSelf は Approver 自身の submitted が pending_approval_count から除外されることを検証する。
// DSH-008 に対応する。
func TestGetDashboard_Approver_PendingApprovalExcludesSelf(t *testing.T) {
	srv, pool := setupDashboardTest(t)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)

	// userApprover 自身が submitted レポートを 1 件作成する。
	testutil.CreateReport(t, pool, tenantID, approverID,
		testutil.WithReportStatus(domain.ReportStatusSubmitted),
		testutil.WithReportTitle("Approver自身の提出済みレポート"),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.PendingApprovalCount == nil {
		t.Fatal("pending_approval_count が null です")
	}
	// userMember の submitted 1 件のみカウント。Approver 自身の submitted は除外される。
	if got, want := *resp.Data.PendingApprovalCount, 1; got != want {
		t.Errorf("pending_approval_count（自分除外後）: got %d, want %d", got, want)
	}
}

// TestGetDashboard_Approver_MonthlySummaryPresent は Approver レスポンスに monthly_summary が存在することを検証する。
// DSH-009 に対応する。
func TestGetDashboard_Approver_MonthlySummaryPresent(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	if _, exists := data["monthly_summary"]; !exists {
		t.Error("Approver レスポンスに monthly_summary が含まれていません")
	}

	// monthly_summary が配列であることを確認する（要素数 0〜3）。
	if ms, ok := data["monthly_summary"].([]interface{}); ok {
		if got := len(ms); got > 3 {
			t.Errorf("monthly_summary の件数が 3 を超えています: got %d", got)
		}
	}
}

// =============================================================================
// DSH-010〜DSH-013: Accounting ロール — 返却フィールドテスト
// =============================================================================

// TestGetDashboard_Accounting_MemberFieldsPresent は Accounting レスポンスに Member フィールドが含まれることを検証する。
// DSH-010 に対応する。
func TestGetDashboard_Accounting_MemberFieldsPresent(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	requiredFields := []string{
		"my_draft_count",
		"my_submitted_count",
		"my_rejected_count",
		"recent_reports",
	}
	for _, field := range requiredFields {
		if _, exists := data[field]; !exists {
			t.Errorf("Accounting レスポンスに %q が含まれていません（含まれるべき）", field)
		}
	}
}

// TestGetDashboard_Accounting_PendingPaymentCount は Accounting の pending_payment_count が正しく返ることを検証する。
// DSH-011 に対応する。
// フィクスチャ: テナントA に approved が 2 件存在する。
func TestGetDashboard_Accounting_PendingPaymentCount(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.PendingPaymentCount == nil {
		t.Fatal("pending_payment_count が null です")
	}
	// フィクスチャの approved レポートが 2 件。
	if got, want := *resp.Data.PendingPaymentCount, 2; got != want {
		t.Errorf("pending_payment_count: got %d, want %d", got, want)
	}
}

// TestGetDashboard_Accounting_MonthlySummaryPresent は Accounting レスポンスに monthly_summary が存在することを検証する。
// DSH-012 に対応する。
func TestGetDashboard_Accounting_MonthlySummaryPresent(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	if _, exists := data["monthly_summary"]; !exists {
		t.Error("Accounting レスポンスに monthly_summary が含まれていません")
	}
}

// TestGetDashboard_Accounting_NoApproverFields は Accounting レスポンスに pending_approval_count が含まれないことを検証する。
// DSH-013 に対応する。
func TestGetDashboard_Accounting_NoApproverFields(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	if _, exists := data["pending_approval_count"]; exists {
		t.Error("Accounting レスポンスに pending_approval_count が含まれています（含まれるべきでない）")
	}
}

// =============================================================================
// DSH-014〜DSH-017: Admin ロール — 返却フィールドテスト
// =============================================================================

// TestGetDashboard_Admin_TenantCounts は Admin のテナント全体集計が正しく返ることを検証する。
// DSH-014 に対応する。
// フィクスチャ: テナントA に draft × 2, submitted × 1, approved × 1, rejected × 1, paid × 3 が存在する。
// paid が 3 件なのは issue-087 の修正で直近 3 ヶ月（当月・前月・前々月）に分散させたため。
func TestGetDashboard_Admin_TenantCounts(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	tests := []struct {
		name string
		got  *int
		want int
	}{
		{"tenant_draft_count", resp.Data.TenantDraftCount, 2},
		{"tenant_submitted_count", resp.Data.TenantSubmittedCount, 1},
		{"tenant_approved_count", resp.Data.TenantApprovedCount, 1},
		{"tenant_rejected_count", resp.Data.TenantRejectedCount, 1},
		// issue-087: 直近 3 ヶ月（当月・前月・前々月）に paid レポートを 1 件ずつ追加したため 3 件になる。
		{"tenant_paid_count", resp.Data.TenantPaidCount, 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got == nil {
				t.Fatalf("%s が null です", tt.name)
			}
			if got, want := *tt.got, tt.want; got != want {
				t.Errorf("%s: got %d, want %d", tt.name, got, want)
			}
		})
	}
}

// TestGetDashboard_Admin_TenantMemberCount は Admin の tenant_member_count が正しく返ることを検証する。
// DSH-015 に対応する。
// フィクスチャ: テナントA に 6 名のメンバーが存在する。
func TestGetDashboard_Admin_TenantMemberCount(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.TenantMemberCount == nil {
		t.Fatal("tenant_member_count が null です")
	}
	if got, want := *resp.Data.TenantMemberCount, 6; got != want {
		t.Errorf("tenant_member_count: got %d, want %d", got, want)
	}
}

// TestGetDashboard_Admin_MonthlySummaryPresent は Admin レスポンスに monthly_summary が存在することを検証する。
// DSH-016 に対応する。
func TestGetDashboard_Admin_MonthlySummaryPresent(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	if _, exists := data["monthly_summary"]; !exists {
		t.Error("Admin レスポンスに monthly_summary が含まれていません")
	}
}

// TestGetDashboard_Admin_NoMyDraftCount は Admin レスポンスに個人カウントフィールドが含まれないことを検証する。
// DSH-017 に対応する。
func TestGetDashboard_Admin_NoMyDraftCount(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	data := parseDashboardResponseRaw(t, rec.Body.Bytes())

	// Admin には個人カウント・ワークフローカウントが含まれない。
	absentFields := []string{
		"my_draft_count",
		"my_submitted_count",
		"my_rejected_count",
		"recent_reports",
		"pending_approval_count",
		"pending_payment_count",
	}
	for _, field := range absentFields {
		if _, exists := data[field]; exists {
			t.Errorf("Admin レスポンスに %q が含まれています（含まれるべきでない）", field)
		}
	}
}

// =============================================================================
// DSH-018: テナント分離テスト
// =============================================================================

// =============================================================================
// DSH-019: monthly_summary 集計精度テスト
// =============================================================================

// TestGetDashboard_MonthlySummary_OnlyPaidIncluded は monthly_summary が paid ステータスのレポートのみを
// 集計することを検証する。DSH-019 に対応する。
//
// テスト設計:
//   - 集計軸は period_start（対象期間の開始日）であるため、当月の period_start を持つレポートを作成する
//   - 同じ月に approved（10000円）と paid（5000円）のレポートを作成する
//   - API レスポンスの monthly_summary から当月の total_amount を取得する
//   - total_amount が paid 分の 5000 のみであることをアサートする
//   - approved の 10000 が含まれていないことを明示的に確認する
func TestGetDashboard_MonthlySummary_OnlyPaidIncluded(t *testing.T) {
	srv, pool := setupDashboardTest(t)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)

	// 当月の1日を period_start として設定する（monthly_summary の集計軸は period_start）。
	now := time.Now().UTC()
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	// 当月末日を period_end として設定する（CHECK (period_start <= period_end) 制約を満たすため）。
	currentMonthEnd := currentMonthStart.AddDate(0, 1, -1)

	// テスト追加レポートが当月集計に紛れ込む量を観測するため、追加前の seed 由来 paid 合計を取得する。
	// seed 拡張（issue 087）で当月に paid レポートが含まれる場合があるため、ハードコード値ではなく動的に算出する。
	var seedPaidBaseline int
	if err := pool.QueryRow(context.Background(),
		`SELECT COALESCE(SUM(total_amount), 0)
		 FROM expense_reports
		 WHERE tenant_id = $1
		   AND status = 'paid'
		   AND period_start >= $2
		   AND period_start < $3
		   AND deleted_at IS NULL`,
		tenantID, currentMonthStart, currentMonthStart.AddDate(0, 1, 0),
	).Scan(&seedPaidBaseline); err != nil {
		t.Fatalf("seed 由来の当月 paid 合計取得に失敗しました: %v", err)
	}

	// approved ステータスのレポートを作成する（10000円）。
	// monthly_summary の集計に含まれてはならない。
	testutil.CreateReport(t, pool, tenantID, approverID,
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportTotalAmount(10000),
		testutil.WithReportPeriodStart(currentMonthStart),
		testutil.WithReportPeriodEnd(currentMonthEnd),
		testutil.WithReportTitle("集計対象外の承認済みレポート（10000円）"),
	)

	// paid ステータスのレポートを作成する（5000円）。
	// monthly_summary の集計に含まれる必要がある。
	testutil.CreateReport(t, pool, tenantID, approverID,
		testutil.WithReportStatus(domain.ReportStatusPaid),
		testutil.WithReportTotalAmount(5000),
		testutil.WithReportPeriodStart(currentMonthStart),
		testutil.WithReportPeriodEnd(currentMonthEnd),
		testutil.WithReportTitle("集計対象の支払済みレポート（5000円）"),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.MonthlySummary == nil {
		t.Fatal("monthly_summary が null です")
	}

	// 当月の年月文字列を取得する。
	currentYearMonth := now.Format("2006-01")

	// 当月のエントリを monthly_summary から検索する。
	var currentMonthAmount *int
	for _, entry := range *resp.Data.MonthlySummary {
		if entry.YearMonth == currentYearMonth {
			amount := entry.TotalAmount
			currentMonthAmount = &amount
			break
		}
	}

	if currentMonthAmount == nil {
		t.Fatalf("monthly_summary に当月（%s）のエントリが存在しません", currentYearMonth)
	}

	// 期待値: seed 由来の当月 paid 合計 + 今回追加した paid レポート（5000円）。
	// approved（10000円）は集計対象外のため含めない。
	wantAmount := seedPaidBaseline + 5000
	if got := *currentMonthAmount; got != wantAmount {
		t.Errorf("monthly_summary[%s].total_amount: got %d, want %d (seed baseline=%d + test paid=5000)\n"+
			"（approved の 10000 円が含まれている可能性があります）",
			currentYearMonth, got, wantAmount, seedPaidBaseline)
	}

	// approved の金額（10000）が含まれていないことを明示的に確認する。
	// もし approved が混入していれば total_amount は wantAmount + 10000 になる。
	if got := *currentMonthAmount; got == wantAmount+10000 {
		t.Errorf("monthly_summary に approved の金額（10000円）が混入しています: got %d", got)
	}
}

// TestGetDashboard_TenantIsolation_CountsExcludeOtherTenant はテナントAのカウントにテナントBのレポートが含まれないことを検証する。
// DSH-018 に対応する。
// フィクスチャ: テナントB に draft が 1 件存在する。テナントA の userMember は draft 2 件（ReportDraftID + ReportDraftEmptyID）。
func TestGetDashboard_TenantIsolation_CountsExcludeOtherTenant(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp dashboardResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if resp.Data.MyDraftCount == nil {
		t.Fatal("my_draft_count が null です")
	}
	// テナントA の userMember の draft 件数のみ（テナントB のレポートは含まれない）。
	// フィクスチャでは ReportDraftID と ReportDraftEmptyID の 2 件が draft 状態で存在する。
	if got, want := *resp.Data.MyDraftCount, 2; got != want {
		t.Errorf("my_draft_count（テナント分離後）: got %d, want %d", got, want)
	}
}
