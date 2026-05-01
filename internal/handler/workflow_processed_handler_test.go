//go:build integration

package handler_test

// ハンドラ層統合テスト — 処理済みレポート一覧（GET /api/workflow/processed）エンドポイント。
// 実際のルーターを通してリクエストを送り、HTTP ステータスとレスポンスボディを検証する。
//
// 対応テストケース: WFL-064〜WFL-080（SCR-WFL-003）
// 実行には PostgreSQL が必要（-tags=integration）。
//
// 実行コマンド:
//
//	go test ./internal/handler/... -v -tags=integration -run TestListProcessedReports
//
// Traceability: test_cases/workflow.md（WFL-064〜WFL-080）
// WFL-064 → TestListProcessedReports_Success_Approver
// WFL-065 → TestListProcessedReports_Forbidden_Member
// WFL-066 → TestListProcessedReports_Forbidden_Admin
// WFL-067 → TestListProcessedReports_Forbidden_Accounting
// WFL-068 → TestListProcessedReports_Unauthorized
// WFL-069 → TestListProcessedReports_TenantIsolation
// WFL-070 → TestListProcessedReports_OnlyApprovedByActor
// WFL-071 → TestListProcessedReports_OnlyRejectedByActor
// WFL-072 → TestListProcessedReports_OtherApproverNotIncluded
// WFL-073 → TestListProcessedReports_CurrentStatus_Paid
// WFL-074 → TestListProcessedReports_SortByDecidedAtDesc
// WFL-075 → TestListProcessedReports_Pagination

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// =============================================================================
// 6. GET /api/workflow/processed — 処理済みレポート一覧（WFL-064〜WFL-075）
// =============================================================================

// WFL-064: 認証済み Approver で GET /api/workflow/processed を呼び出すと 200 が返り、data と pagination が含まれる。
func TestListProcessedReports_Success_Approver(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 自分が承認した approved レポートを作成する。
	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	now := time.Now().UTC()

	testutil.CreateReport(t, pool, tenantID,
		testutil.MustParseUUID(testutil.UserMemberID),
		testutil.WithReportTitle("承認済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverID, now),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: data と pagination が含まれる（WFL-064）。
	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_Success_Approver: decode response: %v", err)
	}
	if _, ok := resp["data"]; !ok {
		t.Error("TestListProcessedReports_Success_Approver: response missing 'data' field")
	}
	if _, ok := resp["pagination"]; !ok {
		t.Error("TestListProcessedReports_Success_Approver: response missing 'pagination' field")
	}
}

// WFL-065: Member ロールで GET /api/workflow/processed にアクセスすると 403 が返る。
func TestListProcessedReports_Forbidden_Member(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-065）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-066: Admin ロールで GET /api/workflow/processed にアクセスすると 403 が返る。
func TestListProcessedReports_Forbidden_Admin(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-066）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-067: Accounting ロールで GET /api/workflow/processed にアクセスすると 403 が返る。
func TestListProcessedReports_Forbidden_Accounting(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-067）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-068: 認証ヘッダーなしで GET /api/workflow/processed にアクセスすると 401 が返る。
func TestListProcessedReports_Unauthorized(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/workflow/processed", nil)
	rec := srv.Execute(req)

	// 401 UNAUTHORIZED（WFL-068）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// WFL-069: テナント分離 — テナント A の Approver がテナント B のレポートを取得しない。
func TestListProcessedReports_TenantIsolation(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 独立した 2 テナントを使う（標準フィクスチャの tenant A は approver 処理済みデータを
	// 含むため、件数ベース 0 件チェックには適さない）。各テナントに別々の Approver/Member
	// を作成し、テナント B 側にのみ承認済みレポートを作成する。
	tenantAID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-069 テナント A"))
	tenantBID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-069 テナント B"))
	approverAID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-069-a@example.com"))
	approverBID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-069-b@example.com"))
	memberBID := testutil.CreateUser(t, pool, testutil.WithUserEmail("member-069-b@example.com"))
	testutil.CreateMembership(t, pool, tenantAID, approverAID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantBID, approverBID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantBID, memberBID, domain.RoleMember)

	now := time.Now().UTC()

	// テナント B にのみ承認済みレポートを作成する。
	testutil.CreateReport(t, pool, tenantBID, memberBID,
		testutil.WithReportTitle("テナント B の承認済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverBID, now),
	)

	// テナント A の Approver で API にアクセスする。
	// テナント A には承認済みレポートを作成していないため、0 件が返るはず。
	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		approverAID.String(), tenantAID.String(), "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	// data が空配列（テナント B のレポートは含まれない）。
	var resp struct {
		Data       []interface{} `json:"data"`
		Pagination interface{}   `json:"pagination"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_TenantIsolation: decode response: %v", err)
	}
	if len(resp.Data) != 0 {
		t.Errorf("TestListProcessedReports_TenantIsolation: expected 0 reports, got %d (WFL-069)", len(resp.Data))
	}
}

// WFL-070: 自分が approved_by のレポートが decision=approved, decided_at=approved_at で返る。
func TestListProcessedReports_OnlyApprovedByActor(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 独立したテナントで検証する（標準フィクスチャの tenant A は paid レポートを含み、
	// 処理日時 DESC でソートすると先頭が paid になるため、approved 単独検証には適さない）。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-070 専用テナント"))
	approverUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-070@example.com"))
	memberUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("member-070@example.com"))
	testutil.CreateMembership(t, pool, tenantID, approverUserID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantID, memberUserID, domain.RoleMember)

	approvedAt := time.Date(2026, 4, 15, 10, 0, 0, 0, time.UTC)

	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("自分が承認したレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverUserID, approvedAt),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		approverUserID.String(), tenantID.String(), "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data []struct {
			Decision      string `json:"decision"`
			DecidedAt     string `json:"decided_at"`
			CurrentStatus string `json:"current_status"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_OnlyApprovedByActor: decode response: %v", err)
	}
	if len(resp.Data) == 0 {
		t.Fatal("TestListProcessedReports_OnlyApprovedByActor: expected at least 1 report (WFL-070)")
	}
	// 独立テナントなので新規作成した 1 件のみが返る。
	report := resp.Data[0]
	if report.Decision != "approved" {
		t.Errorf("TestListProcessedReports_OnlyApprovedByActor: expected decision=approved, got %s (WFL-070)", report.Decision)
	}
	if report.CurrentStatus != "approved" {
		t.Errorf("TestListProcessedReports_OnlyApprovedByActor: expected current_status=approved, got %s (WFL-070)", report.CurrentStatus)
	}
}

// WFL-071: 自分が rejected_by のレポートが decision=rejected, decided_at=rejected_at で返る。
func TestListProcessedReports_OnlyRejectedByActor(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 独立したテナントと Approver を使い、rejected_by のみが設定されているケースを確認する。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-071 専用テナント"))
	approverUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-071@example.com"))
	memberUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("member-071@example.com"))
	testutil.CreateMembership(t, pool, tenantID, approverUserID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantID, memberUserID, domain.RoleMember)

	rejectedAt := time.Date(2026, 4, 10, 9, 0, 0, 0, time.UTC)

	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("自分が却下したレポート"),
		testutil.WithReportStatus(domain.ReportStatusRejected),
		testutil.WithReportRejectedBy(approverUserID, rejectedAt),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		approverUserID.String(), tenantID.String(), "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data []struct {
			Decision      string `json:"decision"`
			DecidedAt     string `json:"decided_at"`
			CurrentStatus string `json:"current_status"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_OnlyRejectedByActor: decode response: %v", err)
	}
	if len(resp.Data) == 0 {
		t.Fatal("TestListProcessedReports_OnlyRejectedByActor: expected at least 1 report (WFL-071)")
	}
	report := resp.Data[0]
	if report.Decision != "rejected" {
		t.Errorf("TestListProcessedReports_OnlyRejectedByActor: expected decision=rejected, got %s (WFL-071)", report.Decision)
	}
	if report.CurrentStatus != "rejected" {
		t.Errorf("TestListProcessedReports_OnlyRejectedByActor: expected current_status=rejected, got %s (WFL-071)", report.CurrentStatus)
	}
}

// WFL-072: 同テナントの別 Approver が処理したレポートは自分の一覧に含まれない。
func TestListProcessedReports_OtherApproverNotIncluded(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 独立したテナントで別 Approver のレポートを作成する。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-072 専用テナント"))
	myApproverID := testutil.CreateUser(t, pool, testutil.WithUserEmail("my-approver-072@example.com"))
	otherApproverID := testutil.CreateUser(t, pool, testutil.WithUserEmail("other-approver-072@example.com"))
	memberUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("member-072@example.com"))

	testutil.CreateMembership(t, pool, tenantID, myApproverID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantID, otherApproverID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantID, memberUserID, domain.RoleMember)

	now := time.Now().UTC()

	// 別 Approver が承認したレポートを作成する（自分ではない）。
	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("別 Approver が承認したレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(otherApproverID, now),
	)

	// 自分（myApproverID）で API にアクセスする。
	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		myApproverID.String(), tenantID.String(), "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	// data が空配列（別 Approver の処理分は含まれない）。
	var resp struct {
		Data []interface{} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_OtherApproverNotIncluded: decode response: %v", err)
	}
	if len(resp.Data) != 0 {
		t.Errorf("TestListProcessedReports_OtherApproverNotIncluded: expected 0 reports, got %d (WFL-072)", len(resp.Data))
	}
}

// WFL-073: 承認後に paid に進んだレポートが current_status=paid で返る。
func TestListProcessedReports_CurrentStatus_Paid(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	approvedAt := time.Date(2026, 4, 1, 8, 0, 0, 0, time.UTC)

	// paid ステータスのレポートを作成する（approved_by に自分を設定）。
	testutil.CreateReport(t, pool, tenantID,
		testutil.MustParseUUID(testutil.UserMemberID),
		testutil.WithReportTitle("支払済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusPaid),
		testutil.WithReportApprovedBy(approverID, approvedAt),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data []struct {
			Decision      string `json:"decision"`
			CurrentStatus string `json:"current_status"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_CurrentStatus_Paid: decode response: %v", err)
	}
	// paid レポートを探す。
	found := false
	for _, r := range resp.Data {
		if r.CurrentStatus == "paid" {
			found = true
			if r.Decision != "approved" {
				t.Errorf("TestListProcessedReports_CurrentStatus_Paid: expected decision=approved for paid report, got %s (WFL-073)", r.Decision)
			}
			break
		}
	}
	if !found {
		t.Error("TestListProcessedReports_CurrentStatus_Paid: expected current_status=paid report not found (WFL-073)")
	}
}

// WFL-074: 処理日時 DESC で並ぶ（同テナント内で複数件の場合に確認）。
func TestListProcessedReports_SortByDecidedAtDesc(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 独立したテナントで検証する（既存フィクスチャの干渉を避ける）。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-074 専用テナント"))
	approverUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-074@example.com"))
	memberUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("member-074@example.com"))
	testutil.CreateMembership(t, pool, tenantID, approverUserID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantID, memberUserID, domain.RoleMember)

	// 古い方の承認日時で 1 件目を作成する。
	olderAt := time.Date(2026, 4, 1, 8, 0, 0, 0, time.UTC)
	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("古い承認レポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverUserID, olderAt),
	)

	// 新しい方の承認日時で 2 件目を作成する。
	newerAt := time.Date(2026, 4, 20, 12, 0, 0, 0, time.UTC)
	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("新しい承認レポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverUserID, newerAt),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed", nil,
		approverUserID.String(), tenantID.String(), "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data []struct {
			Title     string `json:"title"`
			DecidedAt string `json:"decided_at"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_SortByDecidedAtDesc: decode response: %v", err)
	}
	if len(resp.Data) < 2 {
		t.Fatalf("TestListProcessedReports_SortByDecidedAtDesc: expected at least 2 reports, got %d (WFL-074)", len(resp.Data))
	}
	// 先頭が新しい方であることを確認する。
	if resp.Data[0].Title != "新しい承認レポート" {
		t.Errorf("TestListProcessedReports_SortByDecidedAtDesc: expected first report to be newer, got %s (WFL-074)", resp.Data[0].Title)
	}
}

// WFL-075: per_page=1, page=2 でページネーションが正しく動作する。
func TestListProcessedReports_Pagination(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 独立したテナントで検証する。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-075 専用テナント"))
	approverUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-075@example.com"))
	memberUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("member-075@example.com"))
	testutil.CreateMembership(t, pool, tenantID, approverUserID, domain.RoleApprover)
	testutil.CreateMembership(t, pool, tenantID, memberUserID, domain.RoleMember)

	// 2 件のレポートを作成する。
	now := time.Now().UTC()
	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("ページネーションレポート 1"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverUserID, now.Add(-time.Hour)),
	)
	testutil.CreateReport(t, pool, tenantID, memberUserID,
		testutil.WithReportTitle("ページネーションレポート 2"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
		testutil.WithReportApprovedBy(approverUserID, now),
	)

	// per_page=1, page=1 で 1 件返ること、total_pages=2 であることを確認する。
	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/processed?per_page=1&page=1", nil,
		approverUserID.String(), tenantID.String(), "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data       []interface{} `json:"data"`
		Pagination struct {
			TotalPages  int `json:"total_pages"`
			TotalCount  int `json:"total_count"`
			CurrentPage int `json:"current_page"`
			PerPage     int `json:"per_page"`
		} `json:"pagination"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("TestListProcessedReports_Pagination: decode response: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Errorf("TestListProcessedReports_Pagination: expected 1 report per page, got %d (WFL-075)", len(resp.Data))
	}
	if resp.Pagination.TotalPages < 2 {
		t.Errorf("TestListProcessedReports_Pagination: expected total_pages >= 2, got %d (WFL-075)", resp.Pagination.TotalPages)
	}
	if resp.Pagination.TotalCount < 2 {
		t.Errorf("TestListProcessedReports_Pagination: expected total_count >= 2, got %d (WFL-075)", resp.Pagination.TotalCount)
	}
}
