//go:build integration

package handler_test

// 横断テスト — テナント分離マトリクス（CRS-001〜CRS-016）と RBAC マトリクス（CRS-021〜CRS-054）。
//
// 対応テストケース: CRS-001〜CRS-016, CRS-021〜CRS-054
// 実行には PostgreSQL が必要（-tags=integration）。
//
// 実行コマンド:
//
//	go test ./internal/handler/... -v -tags=integration -run TestCrossCutting
//	go test ./internal/handler/... -v -tags=integration -run TestTenantIsolation
//	go test ./internal/handler/... -v -tags=integration -run TestRBAC
//
// Traceability: test_cases/cross-cutting.md §1（テナント分離）、§2（RBACマトリクス）
//
// CRS-001 → TestTenantIsolation_GetReport_OtherTenant_404
// CRS-002 → TestTenantIsolation_UpdateReport_OtherTenant_404
// CRS-003 → TestTenantIsolation_DeleteReport_OtherTenant_404
// CRS-004 → TestTenantIsolation_SubmitReport_OtherTenant_404
// CRS-005 → TestTenantIsolation_CreateItem_OtherTenant_404
// CRS-006 → TestTenantIsolation_UpdateItem_OtherTenant_404
// CRS-007 → TestTenantIsolation_DeleteItem_OtherTenant_404
// CRS-008 → 機能別テスト（attachment_handler_test.go）でカバー済み: TestTenantIsolation_UploadAttachment_OtherTenant_404
// CRS-009 → 機能別テスト（attachment_handler_test.go）でカバー済み: TestTenantIsolation_ListAttachments_OtherTenant_404
// CRS-010 → 機能別テスト（attachment_handler_test.go）でカバー済み: TestTenantIsolation_GetAttachmentDownload_OtherTenant_404
// CRS-010b → 機能別テスト（attachment_handler_test.go）でカバー済み: TestTenantIsolation_GetAttachmentPreview_OtherTenant_404
// CRS-011 → 機能別テスト（attachment_handler_test.go）でカバー済み: TestTenantIsolation_DeleteAttachment_OtherTenant_404
// CRS-012 → TestTenantIsolation_ApproveReport_OtherTenant_404
// CRS-013 → TestTenantIsolation_RejectReport_OtherTenant_404
// CRS-014 → TestTenantIsolation_PayReport_OtherTenant_404
// CRS-015 → TestTenantIsolation_ListTenantMembers_ExcludesOtherTenant
// CRS-016 → TestTenantIsolation_Dashboard_ExcludesOtherTenantData
//
// RBAC マトリクス整合性確認 — 機能別テストでカバー済みとしてクロス参照のみ（実装しない）:
// CRS-021: report_handler_test.go TestListAllReports_Member_Forbidden
// CRS-022: report_handler_test.go TestListAllReports_Approver_Forbidden
// CRS-023: report_handler_test.go TestListAllReports_Admin_Success
// CRS-024: report_handler_test.go TestListAllReports_Accounting_Success
// CRS-025: workflow_handler_test.go TestListPendingReports_Forbidden_Member    (WFL-006)
// CRS-026: workflow_handler_test.go TestListPendingReports_Forbidden_Admin     (WFL-007)
// CRS-027: workflow_handler_test.go TestListPendingReports_Forbidden_Accounting (WFL-008)
// CRS-028: workflow_handler_test.go TestApproveReport_Forbidden_Member    (WFL-019)
// CRS-029: workflow_handler_test.go TestApproveReport_Forbidden_Admin     (WFL-020)
// CRS-030: workflow_handler_test.go TestApproveReport_Forbidden_Accounting (WFL-021)
// CRS-031: workflow_handler_test.go TestRejectReport_Forbidden_Member     (WFL-036)
// CRS-032: workflow_handler_test.go TestRejectReport_Forbidden_Admin      (WFL-037)
// CRS-033: workflow_handler_test.go TestRejectReport_Forbidden_Accounting (WFL-038)
// CRS-034: workflow_handler_test.go TestListPayableReports_Forbidden_Member   (WFL-047)
// CRS-035: workflow_handler_test.go TestListPayableReports_Forbidden_Approver (WFL-048)
// CRS-036: workflow_handler_test.go TestListPayableReports_Forbidden_Admin    (WFL-049)
// CRS-037: workflow_handler_test.go TestMarkReportAsPaid_Forbidden_Member   (WFL-057)
// CRS-038: workflow_handler_test.go TestMarkReportAsPaid_Forbidden_Approver (WFL-058)
// CRS-039: workflow_handler_test.go TestMarkReportAsPaid_Forbidden_Admin    (WFL-059)
// CRS-040: tenant_handler_test.go TestGetTenant_Approver_Forbidden  (TNT-003)
// CRS-041: tenant_handler_test.go TestGetTenant_Member_Forbidden    (TNT-004)
// CRS-042: tenant_handler_test.go TestGetTenant_Accounting_Forbidden (TNT-005)
// CRS-043: tenant_handler_test.go TestListTenantMembers_Approver_Forbidden (TNT-010)
// CRS-044: tenant_handler_test.go TestListTenantMembers_Member_Forbidden   (TNT-011)
// CRS-045: tenant_handler_test.go TestGetTenant_Admin_OK         (TNT-001)
// CRS-046: tenant_handler_test.go TestListTenantMembers_Admin_OK  (TNT-006)
// CRS-047: tenant_handler_test.go TestListTenantMembers_Accounting_OK (TNT-007)
// CRS-048: workflow_handler_test.go TestApproveReport_SelfApproval (WFL-018)
// CRS-049: workflow_handler_test.go TestRejectReport_SelfRejection  (WFL-035)
// CRS-050: workflow_handler_test.go TestMarkReportAsPaid_SelfPayment (WFL-056)
// CRS-052: report_handler_test.go TestUpdateReport_Admin_NotOwner_Forbidden (RPT-038)
// CRS-053: report_handler_test.go TestGetReport_Admin_OtherUserDraft_Success
// CRS-054: workflow_handler_test.go TestApproveReport_Forbidden_Admin (WFL-020) = CRS-029
//
// 本ファイルで実装するケース（機能別テストに未存在）:
// CRS-051 → TestRBAC_Admin_CanEditOwnReport

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupCrossCuttingTest はテスト用 DB を準備し、TestServer と pgxpool.Pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャ（テナントA + テナントB）を投入する。
func setupCrossCuttingTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()
	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)
	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}

// =============================================================================
// §1 テナント分離テスト（CRS-001〜CRS-016）
// =============================================================================
//
// 方針: テナントAのユーザー（userMember）がテナントBのリソースにアクセスすると 404 が返る。
// 403 ではなくリソースが存在しないかのように振る舞うことでリソース存在の秘匿を実現する（policies.md SS9）。

// =============================================================================
// 1-1. 経費レポート — テナント分離（CRS-001〜CRS-004）
// =============================================================================

// CRS-001: テナントBのレポートを GET → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_GetReport_OtherTenant_404(t *testing.T) {
	srv, _ := setupCrossCuttingTest(t)

	// テナントB の report_tenant_b_draft は SeedFixtures で投入済み。
	url := "/api/reports/" + testutil.ReportTenantBDraftID
	req := srv.AuthRequest(t, http.MethodGet, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBのレポートを参照不可（CRS-001）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-002: テナントBのレポートを PUT → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_UpdateReport_OtherTenant_404(t *testing.T) {
	srv, _ := setupCrossCuttingTest(t)

	url := "/api/reports/" + testutil.ReportTenantBDraftID
	// updated_at はバリデーションを通過させるためのダミー値（実値不要: テナント越境は認可チェックで 404 になる）。
	body := bytes.NewBufferString(`{"title":"cross-tenant-update","period_start":"2026-03-01","period_end":"2026-03-31","updated_at":"2026-03-01T00:00:00Z"}`)
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBのレポートを更新不可（CRS-002）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-003: テナントBのレポートを DELETE → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_DeleteReport_OtherTenant_404(t *testing.T) {
	srv, _ := setupCrossCuttingTest(t)

	url := "/api/reports/" + testutil.ReportTenantBDraftID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBのレポートを削除不可（CRS-003）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-004: テナントBのレポートを POST (submit) → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_SubmitReport_OtherTenant_404(t *testing.T) {
	srv, _ := setupCrossCuttingTest(t)

	url := "/api/reports/" + testutil.ReportTenantBDraftID + "/submit"
	// submit エンドポイントは updated_at を必要とする。
	body := bytes.NewBufferString(`{"updated_at":"2026-01-01T00:00:00Z"}`)
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBのレポートを提出不可（CRS-004）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// =============================================================================
// 1-2. 経費明細 — テナント分離（CRS-005〜CRS-007）
// =============================================================================

// CRS-005: テナントBのレポート配下に明細を POST → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_CreateItem_OtherTenant_404(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// カテゴリ ID を取得する。
	catID := testutil.GetTransportCategoryID(t, pool)

	url := "/api/reports/" + testutil.ReportTenantBDraftID + "/items"
	body := bytes.NewBufferString(fmt.Sprintf(`{
		"expense_date":"2026-03-10",
		"amount":1000,
		"category_id":"%s",
		"description":"cross-tenant-item"
	}`, catID.String()))
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBのレポートに明細追加不可（CRS-005）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-006: テナントBのレポート配下の明細を PUT → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_UpdateItem_OtherTenant_404(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// テナントBに動的にレポートと明細を作成する。
	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	catID := testutil.GetTransportCategoryID(t, pool)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, catID)

	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String()
	// updated_at はバリデーションを通過させるためのダミー値（実値不要: テナント越境は認可チェックで 404 になる）。
	body := bytes.NewBufferString(fmt.Sprintf(`{
		"expense_date":"2026-03-10",
		"amount":2000,
		"category_id":"%s",
		"description":"cross-tenant-item-update",
		"updated_at":"2026-03-01T00:00:00Z"
	}`, catID.String()))
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBの明細を更新不可（CRS-006）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-007: テナントBのレポート配下の明細を DELETE → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_DeleteItem_OtherTenant_404(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// テナントBに動的にレポートと明細を作成する。
	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	catID := testutil.GetTransportCategoryID(t, pool)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, catID)

	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAのユーザーはテナントBの明細を削除不可（CRS-007）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// =============================================================================
// 1-3. 添付ファイル — テナント分離（CRS-008〜CRS-011）
//
// すべて attachment_handler_test.go に実装済み。本ファイルでは実装しない。
// クロス参照:
//
//	CRS-008  → TestTenantIsolation_UploadAttachment_OtherTenant_404
//	CRS-009  → TestTenantIsolation_ListAttachments_OtherTenant_404
//	CRS-010  → TestTenantIsolation_GetAttachmentDownload_OtherTenant_404
//	CRS-010b → TestTenantIsolation_GetAttachmentPreview_OtherTenant_404
//	CRS-011  → TestTenantIsolation_DeleteAttachment_OtherTenant_404
//
// =============================================================================

// =============================================================================
// 1-4. ワークフロー — テナント分離（CRS-012〜CRS-014）
// =============================================================================

// CRS-012: テナントBの submitted レポートを Approver（テナントA）が承認 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_ApproveReport_OtherTenant_404(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// テナントB の report_tenant_b_submitted は SeedFixtures で投入済み。
	// updated_at を DB から取得する。
	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportTenantBSubmittedID)

	url := "/api/workflow/" + testutil.ReportTenantBSubmittedID + "/approve"
	body := bytes.NewBufferString(fmt.Sprintf(`{"updated_at":"%s"}`, updatedAt))
	// テナントA の userApprover で実行する。
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAの Approver はテナントBのレポートを承認不可（CRS-012）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-013: テナントBの submitted レポートを Approver（テナントA）が却下 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_RejectReport_OtherTenant_404(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// テナントB の report_tenant_b_submitted は SeedFixtures で投入済み。
	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportTenantBSubmittedID)

	url := "/api/workflow/" + testutil.ReportTenantBSubmittedID + "/reject"
	body := bytes.NewBufferString(fmt.Sprintf(`{
		"rejection_reason":"cross-tenant-reject",
		"updated_at":"%s"
	}`, updatedAt))
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAの Approver はテナントBのレポートを却下不可（CRS-013）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// CRS-014: テナントBの approved レポートを Accounting（テナントA）が支払完了 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_PayReport_OtherTenant_404(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// テナントB の report_tenant_b_approved は SeedFixtures で投入済み。
	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportTenantBApprovedID)

	url := "/api/workflow/" + testutil.ReportTenantBApprovedID + "/pay"
	body := bytes.NewBufferString(fmt.Sprintf(`{"updated_at":"%s"}`, updatedAt))
	// テナントA の userAccounting で実行する。
	req := srv.AuthRequest(t, http.MethodPost, url, body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: テナントAの Accounting はテナントBのレポートを支払完了にできない（CRS-014）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "RESOURCE_NOT_FOUND")
}

// =============================================================================
// 1-5. テナントメンバー — テナント分離（CRS-015）
// =============================================================================

// CRS-015: テナントAの Admin がメンバー一覧を取得 → テナントBの userMemberB が含まれない。
// テナントBに userMemberB が登録済みで、テナントAの Admin がテナントAのメンバーのみを参照できることを検証する。
// DSH-018（dashboard_handler_test.go）は具体的な数値レベルでの集計正確性テストのため共存させる。
func TestTenantIsolation_ListTenantMembers_ExcludesOtherTenant(t *testing.T) {
	srv, _ := setupCrossCuttingTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/tenant/members", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: テナントAのメンバー一覧が返る（CRS-015）。
	testutil.AssertStatus(t, rec, http.StatusOK)

	// レスポンスボディを解析してテナントBの userMemberB が含まれないことを確認する。
	var body struct {
		Data []struct {
			UserID string `json:"user_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("TestTenantIsolation_ListTenantMembers_ExcludesOtherTenant: JSON unmarshal error: %v (body: %s)", err, rec.Body.String())
	}

	for _, member := range body.Data {
		if member.UserID == testutil.UserMemberBID {
			t.Errorf("TestTenantIsolation_ListTenantMembers_ExcludesOtherTenant: テナントBの userMemberB (%s) がテナントAのメンバー一覧に含まれている（CRS-015）", testutil.UserMemberBID)
		}
	}
}

// =============================================================================
// 1-6. ダッシュボード — テナント分離（CRS-016）
// =============================================================================

// CRS-016: テナントBのデータがテナントAの集計値に混入しないこと。
// テナントAの userMember の my_draft_count を確認し、テナントBの draft が含まれないことを検証する。
// DSH-018（dashboard_handler_test.go）は具体的な数値レベルでの集計正確性テストのため共存させる。
func TestTenantIsolation_Dashboard_ExcludesOtherTenantData(t *testing.T) {
	srv, _ := setupCrossCuttingTest(t)

	// テナントA の userMember としてダッシュボードを取得する。
	// テナントA の userMember には report_draft（1件）と report_draft_empty（1件）の 2 件の draft がある。
	// テナントB にも report_tenant_b_draft（1件）が存在するが、集計に含まれてはならない。
	req := srv.AuthRequest(t, http.MethodGet, "/api/dashboard", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: ダッシュボードが返る（CRS-016）。
	testutil.AssertStatus(t, rec, http.StatusOK)

	var body struct {
		Data struct {
			MyDraftCount int `json:"my_draft_count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("TestTenantIsolation_Dashboard_ExcludesOtherTenantData: JSON unmarshal error: %v (body: %s)", err, rec.Body.String())
	}

	// テナントA の userMember の draft 件数がテナントB のデータを含まないこと。
	// SeedFixtures では userMember の draft は 2 件（report_draft, report_draft_empty）。
	// テナントB の draft（report_tenant_b_draft）は含まれないため、my_draft_count <= 2 であること。
	if body.Data.MyDraftCount > 2 {
		t.Errorf("TestTenantIsolation_Dashboard_ExcludesOtherTenantData: my_draft_count=%d はテナントBのデータを含んでいる可能性がある（期待: <= 2）（CRS-016）",
			body.Data.MyDraftCount)
	}
}

// =============================================================================
// §2 RBAC マトリクス整合性確認（CRS-021〜CRS-054）
//
// 機能別テストでカバー済みのケースはコメントでクロス参照のみ行い、重複実装しない。
// 本ファイルで実装するのは機能別テストでカバーされていない組み合わせのみ。
//
// クロス参照リスト（実装しないケース）:
// CRS-021: report_handler_test.go TestListAllReports_Member_Forbidden
// CRS-022: report_handler_test.go TestListAllReports_Approver_Forbidden
// CRS-023: report_handler_test.go TestListAllReports_Admin_Success
// CRS-024: report_handler_test.go TestListAllReports_Accounting_Success
// CRS-025: workflow_handler_test.go TestListPendingReports_Forbidden_Member    (WFL-006)
// CRS-026: workflow_handler_test.go TestListPendingReports_Forbidden_Admin     (WFL-007)
// CRS-027: workflow_handler_test.go TestListPendingReports_Forbidden_Accounting (WFL-008)
// CRS-028: workflow_handler_test.go TestApproveReport_Forbidden_Member    (WFL-019)
// CRS-029: workflow_handler_test.go TestApproveReport_Forbidden_Admin     (WFL-020)
// CRS-030: workflow_handler_test.go TestApproveReport_Forbidden_Accounting (WFL-021)
// CRS-031: workflow_handler_test.go TestRejectReport_Forbidden_Member     (WFL-036)
// CRS-032: workflow_handler_test.go TestRejectReport_Forbidden_Admin      (WFL-037)
// CRS-033: workflow_handler_test.go TestRejectReport_Forbidden_Accounting (WFL-038)
// CRS-034: workflow_handler_test.go TestListPayableReports_Forbidden_Member   (WFL-047)
// CRS-035: workflow_handler_test.go TestListPayableReports_Forbidden_Approver (WFL-048)
// CRS-036: workflow_handler_test.go TestListPayableReports_Forbidden_Admin    (WFL-049)
// CRS-037: workflow_handler_test.go TestMarkReportAsPaid_Forbidden_Member   (WFL-057)
// CRS-038: workflow_handler_test.go TestMarkReportAsPaid_Forbidden_Approver (WFL-058)
// CRS-039: workflow_handler_test.go TestMarkReportAsPaid_Forbidden_Admin    (WFL-059)
// CRS-040: tenant_handler_test.go TestGetTenant_Approver_Forbidden  (TNT-003)
// CRS-041: tenant_handler_test.go TestGetTenant_Member_Forbidden    (TNT-004)
// CRS-042: tenant_handler_test.go TestGetTenant_Accounting_Forbidden (TNT-005)
// CRS-043: tenant_handler_test.go TestListTenantMembers_Approver_Forbidden (TNT-010)
// CRS-044: tenant_handler_test.go TestListTenantMembers_Member_Forbidden   (TNT-011)
// CRS-045: tenant_handler_test.go TestGetTenant_Admin_OK         (TNT-001)
// CRS-046: tenant_handler_test.go TestListTenantMembers_Admin_OK  (TNT-006)
// CRS-047: tenant_handler_test.go TestListTenantMembers_Accounting_OK (TNT-007)
// CRS-048: workflow_handler_test.go TestApproveReport_SelfApproval (WFL-018)
// CRS-049: workflow_handler_test.go TestRejectReport_SelfRejection  (WFL-035)
// CRS-050: workflow_handler_test.go TestMarkReportAsPaid_SelfPayment (WFL-056)
// CRS-052: report_handler_test.go TestUpdateReport_Admin_NotOwner_Forbidden (RPT-038)
// CRS-053: report_handler_test.go TestGetReport_Admin_OtherUserDraft_Success
// CRS-054: workflow_handler_test.go TestApproveReport_Forbidden_Admin (WFL-020) = CRS-029
// =============================================================================

// CRS-051: Admin は自分で作成した draft レポートを PUT で更新できる（RBC-014 Admin の二面性）。
// Admin は管理者権限を持ちつつ、申請者としてレポートを作成・編集する権利も持つ。
func TestRBAC_Admin_CanEditOwnReport(t *testing.T) {
	srv, pool := setupCrossCuttingTest(t)

	// Admin ユーザーが自分のレポートを作成する。
	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantAID := testutil.MustParseUUID(testutil.TenantAID)
	adminReportID := testutil.CreateReport(t, pool, tenantAID, adminID,
		testutil.WithReportTitle("Admin own report"),
		testutil.WithReportStatus(domain.ReportStatusDraft),
	)

	// 楽観的ロック検証を通すため、DB から実際の updated_at を取得する。
	adminReportUpdatedAt := getReportUpdatedAt(t, pool, adminReportID.String())

	// Admin のトークンで自分のレポートを更新する。
	url := "/api/reports/" + adminReportID.String()
	body := bytes.NewBufferString(fmt.Sprintf(`{
		"title":"Admin own report (updated)",
		"period_start":"2026-03-01",
		"period_end":"2026-03-31",
		"updated_at":"%s"
	}`, adminReportUpdatedAt))
	req := srv.AuthRequest(t, http.MethodPut, url, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin は自分のレポートを申請者として編集可能（RBC-014, CRS-051）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}
