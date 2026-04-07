package handler_test

// ハンドラ層統合テスト — 経費レポート CRUD・提出エンドポイント。
// 実際のルーターを通してリクエストを送り、HTTP ステータスとレスポンスボディを検証する。
//
// 対応テストケース: RPT-001〜RPT-064
// 実行には PostgreSQL が必要（-tags=integration）。
//
// 実行コマンド:
//   go test ./internal/handler/... -v -tags=integration -run TestListMyReports
//   go test ./internal/handler/... -v -tags=integration -run TestCreateReport
//   etc.

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupReportTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupReportTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}


// =============================================================================
// 1. GET /api/reports — 自分のレポート一覧（RPT-001〜RPT-007）
// =============================================================================

// RPT-001: Test Member の自分のレポートが返る（他ユーザーのレポートは含まれない）。
func TestListMyReports_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: 自分のレポート一覧が返る（RPT-001）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-002: status=draft フィルタで draft のみが返る。
func TestListMyReports_StatusFilter(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports?status=draft", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: draft 状態のレポートのみ返る（RPT-002）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-003: 自分のレポートが 0 件の場合は data:[] と pagination が返る。
func TestListMyReports_EmptyResult(t *testing.T) {
	srv, pool := setupReportTest(t)

	// テナントAに別ユーザーを作成（レポートなし）
	emptyUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("empty@example.com"))
	testutil.CreateMembership(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		emptyUserID,
		domain.RoleMember,
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports", nil,
		emptyUserID.String(), testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: data:[] と pagination が返る（RPT-003）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-004: 認証トークンなし → 401。
func TestListMyReports_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/reports", nil)
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// RPT-005: Approver は自分のレポートを取得できる（RBC-010）。
func TestListMyReports_RBAC_Approver(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver は申請系操作可能（RBC-010）（RPT-005）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-006: Accounting は自分のレポートを取得できる。
func TestListMyReports_RBAC_Accounting(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting は自分のレポートを取得できる（RPT-006）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-007: Admin は自分のレポートを取得できる。
func TestListMyReports_RBAC_Admin(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin は自分のレポートを取得できる（RPT-007）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// =============================================================================
// 2. POST /api/reports — レポート作成（RPT-008〜RPT-013）
// =============================================================================

// RPT-008: 正常系 — レポート作成成功。status=draft で返る。
func TestCreateReport_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":        "出張費 3月",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: status=draft のレポートが返る（RPT-008）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// RPT-009: title="" → 422 VALIDATION_ERROR。
func TestCreateReport_ValidationError_EmptyTitle(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":        "",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: title は必須（RPT-009）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-010: period_from > period_to → 422 VALIDATION_ERROR。
func TestCreateReport_ValidationError_PeriodRange(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":        "テスト",
		"period_start": "2026-03-31",
		"period_end":   "2026-03-01", // 終了が開始より前
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: period_from > period_to（RPT-010）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-011: 認証トークンなし → 401。
func TestCreateReport_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":        "テスト",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "/api/reports", body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// RPT-012: Approver もレポート作成可能（RBC-010）。
func TestCreateReport_RBAC_Approver(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":        "Approver レポート",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 201 Created: Approver は申請系操作可能（RBC-010）（RPT-012）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// RPT-013: Admin も自分のレポート作成可能（RBC-014）。
func TestCreateReport_RBAC_Admin(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":        "Admin レポート",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 201 Created: Admin は自分のレポート作成可能（RBC-014）（RPT-013）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// =============================================================================
// 3. POST /api/reports — 再申請（RPT-014〜RPT-019）
// =============================================================================

// RPT-014: 再申請成功 — 新規レポートが status=draft、reference_report_id 付きで返る。
func TestCreateReport_Resubmit_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":               "再申請レポート",
		"period_start":        "2026-03-01",
		"period_end":          "2026-03-31",
		"reference_report_id": testutil.ReportRejectedID,
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: 新規レポートが status=draft、reference_report_id 付きで返る（RPT-014）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// RPT-015: 再申請後に元レポートの状態は rejected のまま変わらない（ドメイン単体テスト補完）。
// ここではハンドラ経由で確認する統合側のみ記述。実際検証はドメイン単体（domain/report_test.go）が担当。
func TestCreateReport_Resubmit_OriginalStatusUnchanged(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":               "再申請",
		"period_start":        "2026-03-01",
		"period_end":          "2026-03-31",
		"reference_report_id": testutil.ReportRejectedID,
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	srv.Execute(req)

	// 元レポートを取得して rejected のままか確認
	getReq := srv.AuthRequest(t, http.MethodGet,
		"/api/reports/"+testutil.ReportRejectedID, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	getRec := srv.Execute(getReq)

	// 200 OK: 元レポートが rejected のまま返る（RPT-015）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, getRec, http.StatusOK)
}

// RPT-016: 再申請で作成した新規レポートに reference_report_id がセットされている。
// ハンドラが実装されたときに 201 レスポンスから reference_report_id を確認する。
func TestCreateReport_Resubmit_ReferenceIdSet(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":               "参照付き再申請",
		"period_start":        "2026-03-01",
		"period_end":          "2026-03-31",
		"reference_report_id": testutil.ReportRejectedID,
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: 新規レポートに reference_report_id がセットされている（RPT-016）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// RPT-017: 再申請で元レポートの添付ファイルはコピーされない（添付 0 件）。
// ハンドラ実装後に items の attachments を確認する統合テスト。
func TestCreateReport_Resubmit_AttachmentsNotCopied(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":               "添付なし再申請",
		"period_start":        "2026-03-01",
		"period_end":          "2026-03-31",
		"reference_report_id": testutil.ReportRejectedID,
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: 新規レポートの明細に添付ファイルがコピーされない（RPT-017）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// RPT-018: 再申請で元レポートの明細がコピーされる。
func TestCreateReport_Resubmit_ItemsCopied(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":               "明細コピー確認",
		"period_start":        "2026-03-01",
		"period_end":          "2026-03-31",
		"reference_report_id": testutil.ReportRejectedID,
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: 新規レポートに明細が 2 件コピーされている（RPT-018）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// RPT-019: 再申請元が rejected 以外（draft）の場合 → 422 VALIDATION_ERROR。
func TestCreateReport_Resubmit_NonRejectedSourceFails(t *testing.T) {
	srv, _ := setupReportTest(t)

	body := jsonBody(t, map[string]string{
		"title":               "無効な再申請",
		"period_start":        "2026-03-01",
		"period_end":          "2026-03-31",
		"reference_report_id": testutil.ReportDraftID, // draft は再申請元不可
	})
	req := srv.AuthRequest(t, http.MethodPost, "/api/reports", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: 再申請元は rejected 状態のみ許可（RPT-019）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// =============================================================================
// 4. GET /api/reports/all — 全レポート一覧（RPT-020〜RPT-026）
// =============================================================================

// RPT-020: Admin はテナント全レポートを取得できる（submitter フィールド含む）。
func TestListAllReports_Admin_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports/all", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: テナント全レポートが返る（RPT-020）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-021: Accounting もテナント全レポートを取得できる。
func TestListAllReports_Accounting_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports/all", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting もテナント全レポートを取得できる（RPT-021）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-022: Member は全レポート閲覧不可 → 403。
func TestListAllReports_Member_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports/all", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-023: Approver は全レポート閲覧不可 → 403。
func TestListAllReports_Approver_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports/all", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-024: 認証トークンなし → 401。
func TestListAllReports_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/reports/all", nil)
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// RPT-025: status=submitted フィルタで submitted のみが返る。
func TestListAllReports_StatusFilter(t *testing.T) {
	srv, _ := setupReportTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/reports/all?status=submitted", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: submitted 状態のレポートのみ返る（RPT-025）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-026: submitter_id=Test Member ID フィルタで Test Member のレポートのみ返る。
func TestListAllReports_SubmitterFilter(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/all?submitter_id=" + testutil.UserMemberID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Test Member が作成したレポートのみ返る（RPT-026）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// =============================================================================
// 5. GET /api/reports/{id} — レポート詳細（RPT-027〜RPT-034）
// =============================================================================

// RPT-027: 所有者が自分の draft レポートを取得できる。
func TestGetReport_Owner_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: レポート詳細（items + attachments ネスト）が返る（RPT-027）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-028: Member が他者の draft レポートにアクセス → 403（RBC-010）。
func TestGetReport_Member_OtherUserDraft_Forbidden(t *testing.T) {
	srv, pool := setupReportTest(t)

	// Approver の draft レポートを作成
	approverReportID := testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserApproverID),
	)

	url := fmt.Sprintf("/api/reports/%s", approverReportID)
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Member は他者の draft は閲覧不可（RBC-010）（RPT-028）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-029: Approver が他者の submitted レポートを閲覧できる（RBC-011）。
func TestGetReport_Approver_OtherUserSubmitted_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportSubmittedID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver は submitted 状態の他者レポートを閲覧可能（RBC-011）（RPT-029）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-030: Approver が他者の draft レポートを閲覧 → 403。
func TestGetReport_Approver_OtherUserDraft_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Approver は他者の draft は閲覧不可（RPT-030）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-031: Accounting は他者の draft レポートも閲覧できる。
func TestGetReport_Accounting_OtherUserDraft_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting はテナント内全レポート閲覧可能（RPT-031）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-032: Admin は他者の draft レポートも閲覧できる（RBC-013）。
func TestGetReport_Admin_OtherUserDraft_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin はテナント内全レポート閲覧可能（RBC-013）（RPT-032）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-033: 存在しないレポート ID → 404。
func TestGetReport_NotFound(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/00000000-0000-0000-0000-000000000099"
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（RPT-033）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// RPT-034: 認証トークンなし → 401。
func TestGetReport_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 6. PUT /api/reports/{id} — レポート更新（RPT-035〜RPT-041）
// =============================================================================

// RPT-035: 所有者が draft レポートを更新できる。
func TestUpdateReport_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	body := jsonBody(t, map[string]string{
		"title":        "更新タイトル",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: 更新後のレポートが返る（RPT-035）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-036: 非所有者（Approver）が draft を更新しようとする → 403（RBC-010）。
func TestUpdateReport_NotOwner_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	body := jsonBody(t, map[string]string{
		"title":        "更新タイトル",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 所有者以外は更新不可（RBC-010）（RPT-036）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-037: submitted 状態のレポートを更新しようとする → 422（REPORT_NOT_EDITABLE）。
func TestUpdateReport_NotDraft_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportSubmittedID
	body := jsonBody(t, map[string]string{
		"title":        "更新タイトル",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: draft 以外は編集不可（RPT-037）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-038: Admin であっても他者の draft は更新不可 → 403（RBC-014）。
func TestUpdateReport_Admin_NotOwner_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	body := jsonBody(t, map[string]string{
		"title":        "Admin 更新",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Admin であっても他者の更新不可（RBC-014）（RPT-038）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-039: updated_at が古い値（楽観的ロック競合） → 409 CONFLICT。
func TestUpdateReport_Conflict_OptimisticLock(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	// 古い updated_at を意図的に使用
	body := jsonBody(t, map[string]string{
		"title":        "更新タイトル",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   "2020-01-01T00:00:00Z", // 古い値
	})
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 409 CONFLICT: 楽観的ロック競合（RPT-039）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusConflict)
}

// RPT-040: 存在しないレポート ID → 404。
func TestUpdateReport_NotFound(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/00000000-0000-0000-0000-000000000099"
	body := jsonBody(t, map[string]string{
		"title":        "存在しない",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（RPT-040）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// RPT-041: 認証トークンなし → 401。
func TestUpdateReport_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	body := jsonBody(t, map[string]string{
		"title":        "テスト",
		"period_start": "2026-03-01",
		"period_end":   "2026-03-31",
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, url, body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 7. DELETE /api/reports/{id} — レポート削除（RPT-042〜RPT-047）
// =============================================================================

// RPT-042: 所有者が draft レポートを削除できる → 204。
func TestDeleteReport_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: 論理削除される（RPT-042）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// RPT-043: 非所有者（Approver）が削除しようとする → 403。
func TestDeleteReport_NotOwner_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 非所有者は削除不可（RPT-043）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-044: Admin であっても他者の draft は削除不可 → 403（RBC-014）。
func TestDeleteReport_Admin_NotOwner_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Admin であっても他者の削除不可（RBC-014）（RPT-044）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-045: submitted 状態のレポートを削除しようとする → 422（REPORT_NOT_DELETABLE）。
func TestDeleteReport_Submitted_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportSubmittedID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_DELETABLE: submitted は削除不可（T5 違反）（RPT-045）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-046: 存在しないレポート ID → 404。
func TestDeleteReport_NotFound(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/00000000-0000-0000-0000-000000000099"
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（RPT-046）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// RPT-047: 認証トークンなし → 401。
func TestDeleteReport_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodDelete, url, nil)
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 8. POST /api/reports/{id}/submit — レポート提出（RPT-053〜RPT-064）
// =============================================================================

// RPT-053: 正常系 — draft レポートを提出 → 200、status=submitted。
func TestSubmitReport_Success(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: status=submitted が返る（T1）（RPT-053）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// RPT-054: 非所有者（Approver）が提出しようとする → 403。
func TestSubmitReport_NotOwner_Forbidden(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 非所有者は提出不可（RBC-010）（RPT-054）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// RPT-055: submitted 状態のレポートを再提出 → 422 INVALID_STATE_TRANSITION（X4）。
func TestSubmitReport_NotDraft_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: submitted → submitted は禁止（X4）（RPT-055）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-056: 明細 0 件のレポートを提出 → 422 EMPTY_REPORT_SUBMISSION（RPT-014）。
func TestSubmitReport_EmptyReport_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftEmptyID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 EMPTY_REPORT_SUBMISSION: 明細なしは提出不可（RPT-014）（RPT-056）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-057: テナント内に Approver が 0 人 → 422 NO_APPROVER_IN_TENANT（WFL-014）。
func TestSubmitReport_NoApproverInTenant_Unprocessable(t *testing.T) {
	srv, pool := setupReportTest(t)

	// Approver のいない新規テナントを作成
	noApproverTenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("No Approver Corp"))
	memberUserID := testutil.CreateUser(t, pool, testutil.WithUserEmail("no-approver-member@example.com"))
	testutil.CreateMembership(t, pool, noApproverTenantID, memberUserID, domain.RoleMember)

	// そのテナントの draft レポートを作成（明細 1 件）
	reportID := testutil.CreateReport(t, pool, noApproverTenantID, memberUserID)

	// 交通費カテゴリ ID を取得して明細を追加
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("DB 接続の取得に失敗しました: %v", err)
	}
	defer conn.Release()

	var categoryID string
	if err := conn.QueryRow(ctx,
		`SELECT category_id FROM categories WHERE code = 'transportation' AND tenant_id IS NULL`,
	).Scan(&categoryID); err != nil {
		t.Fatalf("カテゴリ取得に失敗しました: %v", err)
	}
	conn.Release()

	testutil.CreateItem(t, pool, noApproverTenantID, reportID, testutil.MustParseUUID(categoryID))

	url := fmt.Sprintf("/api/reports/%s/submit", reportID)
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		memberUserID.String(), noApproverTenantID.String(), "member")
	rec := srv.Execute(req)

	// 422 NO_APPROVER_IN_TENANT: テナントに Approver 不在（WFL-014）（RPT-057）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-058: updated_at が古い値（楽観的ロック競合） → 409 CONFLICT。
func TestSubmitReport_Conflict_OptimisticLock(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": "2020-01-01T00:00:00Z", // 古い値
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 409 CONFLICT: 楽観的ロック競合（RPT-058）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusConflict)
}

// RPT-059: 存在しないレポート ID → 404。
func TestSubmitReport_NotFound(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/00000000-0000-0000-0000-000000000099/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（RPT-059）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// RPT-060: 認証トークンなし → 401。
func TestSubmitReport_Unauthorized(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, url, body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// RPT-061: X1 — draft → approved は禁止（直接 approve 操作）。
// 実際の approve エンドポイントは /api/workflow/{id}/approve（Approver 専用）。
// draft 状態のレポートに approve を試みると InvalidStateTransition を返すことをハンドラで検証。
func TestSubmitReport_X1_DirectApprove_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	// approve エンドポイント（workflow）に draft レポートを渡す
	url := "/api/workflow/" + testutil.ReportDraftID + "/approve"
	body := jsonBody(t, map[string]interface{}{
		"comment":    nil,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: draft → approved は禁止（X1）（RPT-061）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-062: X2 — draft → rejected は禁止（直接 reject 操作）。
func TestSubmitReport_X2_DirectReject_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/workflow/" + testutil.ReportDraftID + "/reject"
	body := jsonBody(t, map[string]string{
		"reason":     "テスト却下",
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: draft → rejected は禁止（X2）（RPT-062）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-063: X3 — draft → paid は禁止（直接 pay 操作）。
func TestSubmitReport_X3_DirectPay_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/workflow/" + testutil.ReportDraftID + "/pay"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: draft → paid は禁止（X3）（RPT-063）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// RPT-064: X4 — submitted → draft に戻す操作は禁止。
// submit エンドポイントで submitted 状態のレポートを再度 submit → InvalidStateTransition。
func TestSubmitReport_X4_RevertToDraft_Unprocessable(t *testing.T) {
	srv, _ := setupReportTest(t)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/submit"
	body := jsonBody(t, map[string]string{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: submitted → draft は禁止（X4）（RPT-064）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}
