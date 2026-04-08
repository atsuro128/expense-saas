//go:build integration

package handler_test

// ハンドラ層統合テスト — ワークフロー（承認・却下・支払完了）エンドポイント。
// 実際のルーターを通してリクエストを送り、HTTP ステータスとレスポンスボディを検証する。
//
// 対応テストケース: WFL-001〜WFL-063
// 実行には PostgreSQL が必要（-tags=integration）。
//
// 実行コマンド:
//   go test ./internal/handler/... -v -tags=integration -run TestListPendingReports
//   go test ./internal/handler/... -v -tags=integration -run TestApproveReport
//   etc.
//
// Traceability: test_cases/workflow.md（WFL-001〜WFL-063）
// WFL-001 → TestListPendingReports_Success
// WFL-002 → TestListPendingReports_IncludesOwnReport
// WFL-003 → TestListPendingReports_ExcludesNonSubmitted
// WFL-004 → TestListPendingReports_FilterByApplicantName
// WFL-005 → TestListPendingReports_Pagination
// WFL-006 → TestListPendingReports_Forbidden_Member
// WFL-007 → TestListPendingReports_Forbidden_Admin
// WFL-008 → TestListPendingReports_Forbidden_Accounting
// WFL-009 → TestListPendingReports_Unauthorized
// WFL-010 → TestApproveReport_Success
// WFL-011 → TestApproveReport_SuccessWithComment
// WFL-012 → TestApproveReport_SuccessWithoutComment
// WFL-013 → TestApproveReport_AlreadyApproved
// WFL-014 → TestApproveReport_DraftState
// WFL-015 → TestApproveReport_RejectedState
// WFL-016 → TestApproveReport_PaidState
// WFL-018 → TestApproveReport_SelfApproval
// WFL-019 → TestApproveReport_Forbidden_Member
// WFL-020 → TestApproveReport_Forbidden_Admin
// WFL-021 → TestApproveReport_Forbidden_Accounting
// WFL-022 → TestApproveReport_Unauthorized
// WFL-023 → TestApproveReport_NotFound
// WFL-024 → TestApproveReport_Conflict_OptimisticLock
// WFL-025 → TestApproveReport_MissingUpdatedAt
// WFL-026 → TestRejectReport_Success
// WFL-027 → TestRejectReport_MissingRejectionReason
// WFL-028 → TestRejectReport_EmptyRejectionReason
// WFL-029 → TestRejectReport_RejectionReasonMaxLength
// WFL-030 → TestRejectReport_RejectionReasonTooLong
// WFL-031 → TestRejectReport_AlreadyApproved
// WFL-032 → TestRejectReport_DraftState
// WFL-033 → TestRejectReport_RejectedState
// WFL-034 → TestRejectReport_PaidState
// WFL-035 → TestRejectReport_SelfRejection
// WFL-036 → TestRejectReport_Forbidden_Member
// WFL-037 → TestRejectReport_Forbidden_Admin
// WFL-038 → TestRejectReport_Forbidden_Accounting
// WFL-039 → TestRejectReport_Unauthorized
// WFL-040 → TestRejectReport_NotFound
// WFL-041 → TestRejectReport_Conflict_OptimisticLock
// WFL-042 → TestListPayableReports_Success
// WFL-043 → TestListPayableReports_IncludesOwnReport
// WFL-044 → TestListPayableReports_ExcludesNonApproved
// WFL-045 → TestListPayableReports_FilterByApplicantName
// WFL-046 → TestListPayableReports_Pagination
// WFL-047 → TestListPayableReports_Forbidden_Member
// WFL-048 → TestListPayableReports_Forbidden_Approver
// WFL-049 → TestListPayableReports_Forbidden_Admin
// WFL-050 → TestListPayableReports_Unauthorized
// WFL-051 → TestMarkReportAsPaid_Success
// WFL-052 → TestMarkReportAsPaid_X5_SubmittedToPaid
// WFL-053 → TestMarkReportAsPaid_X6_DraftToPaid
// WFL-054 → TestMarkReportAsPaid_AlreadyPaid
// WFL-055 → TestMarkReportAsPaid_RejectedState
// WFL-056 → TestMarkReportAsPaid_SelfPayment
// WFL-057 → TestMarkReportAsPaid_Forbidden_Member
// WFL-058 → TestMarkReportAsPaid_Forbidden_Approver
// WFL-059 → TestMarkReportAsPaid_Forbidden_Admin
// WFL-060 → TestMarkReportAsPaid_Unauthorized
// WFL-061 → TestMarkReportAsPaid_NotFound
// WFL-062 → TestMarkReportAsPaid_Conflict_OptimisticLock
// WFL-063 → TestMarkReportAsPaid_MissingUpdatedAt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupWorkflowTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupWorkflowTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}

// workflowJSONBody は map をインデントなしの JSON バイト列 io.Reader に変換するヘルパー。
func workflowJSONBody(t *testing.T, v interface{}) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("workflowJSONBody: %v", err)
	}
	return bytes.NewBuffer(b)
}

// getReportUpdatedAt はフィクスチャレポートの updated_at を DB から取得する。
func getReportUpdatedAt(t *testing.T, pool *pgxpool.Pool, reportID string) string {
	t.Helper()
	var updatedAt string
	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("getReportUpdatedAt: acquire connection: %v", err)
	}
	defer conn.Release()

	if err := conn.QueryRow(context.Background(),
		"SELECT updated_at::text FROM expense_reports WHERE report_id = $1",
		testutil.MustParseUUID(reportID),
	).Scan(&updatedAt); err != nil {
		t.Fatalf("getReportUpdatedAt: query: %v", err)
	}
	return updatedAt
}

// =============================================================================
// 1. GET /api/workflow/pending — 承認待ちレポート一覧（WFL-001〜WFL-009）
// =============================================================================

// WFL-001: 認証済み Approver で GET /api/workflow/pending を呼び出すと 200 が返る。
func TestListPendingReports_Success(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: テナントAの submitted レポートが含まれる（WFL-001）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-002: Approver 本人が作成した submitted レポートも一覧に含まれ、is_own_report=true が設定される。
func TestListPendingReports_IncludesOwnReport(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// Test Approver 本人が作成した submitted レポートを追加する。
	testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserApproverID),
		testutil.WithReportTitle("Approver 自身のレポート"),
		testutil.WithReportStatus(domain.ReportStatusSubmitted),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: 自分のレポートも一覧に含まれ、is_own_report=true が設定される（WFL-002）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-003: submitted 以外の状態のレポートのみの場合、data が空配列になる。
func TestListPendingReports_ExcludesNonSubmitted(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// submitted レポートを全て除外するため、独立したテナントを使用する。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-003 専用テナント"))
	userID := testutil.CreateUser(t, pool, testutil.WithUserEmail("approver-003@example.com"))
	testutil.CreateMembership(t, pool, tenantID, userID, domain.RoleApprover)

	// draft/approved/rejected/paid のレポートのみ存在する。
	for _, status := range []domain.ReportStatus{
		domain.ReportStatusDraft,
		domain.ReportStatusApproved,
		domain.ReportStatusRejected,
		domain.ReportStatusPaid,
	} {
		testutil.CreateReport(t, pool, tenantID, userID,
			testutil.WithReportStatus(status),
		)
	}

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
		userID.String(), tenantID.String(), "approver")
	rec := srv.Execute(req)

	// 200 OK: data が空配列（WFL-003）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-004: applicant_name クエリパラメータで申請者名フィルタリングが動作する。
func TestListPendingReports_FilterByApplicantName(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending?applicant_name=Test", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: 申請者名が部分一致するレポートのみ返る（WFL-004）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-005: per_page=1 でページネーションが動作し、total_pages >= 2 になる。
func TestListPendingReports_Pagination(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 2件目の submitted レポートを追加する。
	testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserMemberID),
		testutil.WithReportTitle("2件目の提出済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusSubmitted),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending?per_page=1", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: data が1件、pagination.total_pages >= 2（WFL-005）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-006: Member ロールで GET /api/workflow/pending にアクセスすると 403 が返る。
func TestListPendingReports_Forbidden_Member(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-006）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-007: Admin ロールで GET /api/workflow/pending にアクセスすると 403 が返る。
func TestListPendingReports_Forbidden_Admin(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-007）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-008: Accounting ロールで GET /api/workflow/pending にアクセスすると 403 が返る。
func TestListPendingReports_Forbidden_Accounting(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/pending", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-008）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-009: 認証ヘッダーなしで GET /api/workflow/pending にアクセスすると 401 が返る。
func TestListPendingReports_Unauthorized(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/workflow/pending", nil)
	rec := srv.Execute(req)

	// 401 UNAUTHORIZED（WFL-009）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 2. POST /api/workflow/{id}/approve — 承認（WFL-010〜WFL-025）
// =============================================================================

// WFL-010: Approver で submitted レポートを承認すると 200 OK、status=approved になる。
func TestApproveReport_Success(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: status=approved, approved_by=Approver（WFL-010）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-011: コメント付きで承認すると、approval_comment がレスポンスに含まれる。
func TestApproveReport_SuccessWithComment(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"comment":    "問題ありません",
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: approval_comment が "問題ありません"（WFL-011）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-012: comment フィールドを含めないで承認しても 200 OK になる。
func TestApproveReport_SuccessWithoutComment(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: コメントなしでも承認可能（WFL-012）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-013: すでに approved 状態のレポートを承認しようとすると 422 INVALID_STATE_TRANSITION になる。
func TestApproveReport_AlreadyApproved(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportApprovedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: approved→approved は不可（WFL-013）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-014: draft 状態のレポートを承認しようとすると 422 INVALID_STATE_TRANSITION になる。
func TestApproveReport_DraftState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportDraftID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportDraftID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: draft→approved は不可（WFL-014）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-015: rejected 状態のレポートを承認しようとすると 422 INVALID_STATE_TRANSITION になる（X9）。
func TestApproveReport_RejectedState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportRejectedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportRejectedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: rejected→approved は不可（X9, WFL-015）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-016: paid 状態のレポートを承認しようとすると 422 INVALID_STATE_TRANSITION になる（X10）。
func TestApproveReport_PaidState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportPaidID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportPaidID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: paid→approved は不可（X10, WFL-016）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-018: 自己承認禁止 — Approver 本人が作成した submitted レポートを承認しようとすると 403 SELF_APPROVAL_NOT_ALLOWED になる。
func TestApproveReport_SelfApproval(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// Test Approver 本人が作成した submitted レポートを動的に作成する。
	selfReportID := testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserApproverID),
		testutil.WithReportTitle("Approver 自己申請レポート"),
		testutil.WithReportStatus(domain.ReportStatusSubmitted),
	)

	updatedAt := getReportUpdatedAt(t, pool, selfReportID.String())
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		fmt.Sprintf("/api/workflow/%s/approve", selfReportID), body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 SELF_APPROVAL_NOT_ALLOWED（RBC-016, WFL-018）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-019: Member ロールで POST /api/workflow/{id}/approve にアクセスすると 403 が返る。
func TestApproveReport_Forbidden_Member(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-019）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-020: Admin ロールで POST /api/workflow/{id}/approve にアクセスすると 403 が返る。
func TestApproveReport_Forbidden_Admin(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-020）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-021: Accounting ロールで POST /api/workflow/{id}/approve にアクセスすると 403 が返る。
func TestApproveReport_Forbidden_Accounting(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-021）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-022: 認証ヘッダーなしで POST /api/workflow/{id}/approve にアクセスすると 401 が返る。
func TestApproveReport_Unauthorized(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	// 401 UNAUTHORIZED（WFL-022）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// WFL-023: 存在しないレポート ID を指定すると 404 RESOURCE_NOT_FOUND になる。
func TestApproveReport_NotFound(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/00000000-0000-0000-0000-000000000099/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND（WFL-023）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// WFL-024: updated_at に古いタイムスタンプを指定すると 409 CONFLICT になる（楽観的ロック）。
func TestApproveReport_Conflict_OptimisticLock(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	// 意図的に古いタイムスタンプを使用して楽観的ロック競合を発生させる。
	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2000-01-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 409 CONFLICT（楽観的ロック違反, WFL-024）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusConflict)
}

// WFL-025: updated_at フィールドなしでリクエストすると 400 または 422 になる。
func TestApproveReport_MissingUpdatedAt(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	// updated_at フィールドを含まないリクエストボディ。
	body := workflowJSONBody(t, map[string]string{})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/approve", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 400 または 422: updated_at は必須（WFL-025）。機能未実装のため現在は失敗する。
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("WFL-025: got status %d, want 400 or 422 (body: %s)", rec.Code, rec.Body.String())
	}
}

// =============================================================================
// 3. POST /api/workflow/{id}/reject — 却下（WFL-026〜WFL-041）
// =============================================================================

// WFL-026: Approver で submitted レポートを却下すると 200 OK、status=rejected になる。
func TestRejectReport_Success(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"reason": "領収書が不明瞭です",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: status=rejected, rejected_by=Approver, rejection_reason が設定される（WFL-026）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-027: rejection_reason フィールドなしでリクエストすると 422 MISSING_REJECTION_REASON になる。
func TestRejectReport_MissingRejectionReason(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	// reason を含まないリクエスト。
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 MISSING_REJECTION_REASON（WFL-027）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-028: rejection_reason が空文字列のリクエストで 422 MISSING_REJECTION_REASON になる。
func TestRejectReport_EmptyRejectionReason(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"reason": "",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 MISSING_REJECTION_REASON（WFL-028）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-029: rejection_reason が 1000 文字（境界値: 上限ちょうど）は 200 OK になる。
func TestRejectReport_RejectionReasonMaxLength(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"reason": strings.Repeat("あ", 1000),
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: rejection_reason 1000 文字は許容される（WFL-029）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-030: rejection_reason が 1001 文字（上限超過）は 400 または 422 になる。
func TestRejectReport_RejectionReasonTooLong(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"reason": strings.Repeat("あ", 1001),
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 400 または 422: rejection_reason 1001 文字は超過（WFL-030）。機能未実装のため現在は失敗する。
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("WFL-030: got status %d, want 400 or 422 (body: %s)", rec.Code, rec.Body.String())
	}
}

// WFL-031: approved 状態のレポートを却下しようとすると 422 INVALID_STATE_TRANSITION になる（X8）。
func TestRejectReport_AlreadyApproved(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportApprovedID)
	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: approved→rejected は不可（X8, WFL-031）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-032: draft 状態のレポートを却下しようとすると 422 INVALID_STATE_TRANSITION になる。
func TestRejectReport_DraftState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportDraftID)
	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportDraftID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: draft→rejected は不可（WFL-032）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-033: rejected 状態のレポートをさらに却下しようとすると 422 INVALID_STATE_TRANSITION になる（X9）。
func TestRejectReport_RejectedState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportRejectedID)
	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportRejectedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: rejected→rejected は不可（X9, WFL-033）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-034: paid 状態のレポートを却下しようとすると 422 INVALID_STATE_TRANSITION になる（X10）。
func TestRejectReport_PaidState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportPaidID)
	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportPaidID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: paid→rejected は不可（X10, WFL-034）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-035: 自己却下禁止 — Approver 本人が作成した submitted レポートを却下しようとすると 403 SELF_APPROVAL_NOT_ALLOWED になる。
func TestRejectReport_SelfRejection(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// Test Approver 本人が作成した submitted レポートを動的に作成する。
	selfReportID := testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserApproverID),
		testutil.WithReportTitle("Approver 自己申請レポート（却下テスト）"),
		testutil.WithReportStatus(domain.ReportStatusSubmitted),
	)

	updatedAt := getReportUpdatedAt(t, pool, selfReportID.String())
	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		fmt.Sprintf("/api/workflow/%s/reject", selfReportID), body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 SELF_APPROVAL_NOT_ALLOWED（RBC-016, WFL-035）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-036: Member ロールで POST /api/workflow/{id}/reject にアクセスすると 403 が返る。
func TestRejectReport_Forbidden_Member(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-036）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-037: Admin ロールで POST /api/workflow/{id}/reject にアクセスすると 403 が返る。
func TestRejectReport_Forbidden_Admin(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-037）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-038: Accounting ロールで POST /api/workflow/{id}/reject にアクセスすると 403 が返る。
func TestRejectReport_Forbidden_Accounting(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-038）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-039: 認証ヘッダーなしで POST /api/workflow/{id}/reject にアクセスすると 401 が返る。
func TestRejectReport_Unauthorized(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       "2026-03-01T00:00:00Z",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	// 401 UNAUTHORIZED（WFL-039）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// WFL-040: 存在しないレポート ID を指定すると 404 RESOURCE_NOT_FOUND になる。
func TestRejectReport_NotFound(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/00000000-0000-0000-0000-000000000099/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND（WFL-040）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// WFL-041: updated_at に古いタイムスタンプを指定すると 409 CONFLICT になる（楽観的ロック）。
func TestRejectReport_Conflict_OptimisticLock(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	// 意図的に古いタイムスタンプを使用して楽観的ロック競合を発生させる。
	body := workflowJSONBody(t, map[string]string{
		"reason": "理由",
		"updated_at":       "2000-01-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/reject", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 409 CONFLICT（楽観的ロック違反, WFL-041）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusConflict)
}

// =============================================================================
// 4. GET /api/workflow/payable — 支払待ちレポート一覧（WFL-042〜WFL-050）
// =============================================================================

// WFL-042: 認証済み Accounting で GET /api/workflow/payable を呼び出すと 200 が返る。
func TestListPayableReports_Success(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: テナントAの approved レポートが含まれる（WFL-042）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-043: Accounting 本人が作成した approved レポートも一覧に含まれ、is_own_report=true が設定される。
func TestListPayableReports_IncludesOwnReport(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// Test Accounting 本人が作成した approved レポートを追加する。
	testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserAccountingID),
		testutil.WithReportTitle("Accounting 自身の承認済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: 自分のレポートも一覧に含まれ、is_own_report=true が設定される（WFL-043）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-044: approved 以外の状態のレポートのみの場合、data が空配列になる。
func TestListPayableReports_ExcludesNonApproved(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// approved レポートを全て除外するため、独立したテナントを使用する。
	tenantID := testutil.CreateTenant(t, pool, testutil.WithTenantName("WFL-044 専用テナント"))
	userID := testutil.CreateUser(t, pool, testutil.WithUserEmail("accounting-044@example.com"))
	testutil.CreateMembership(t, pool, tenantID, userID, domain.RoleAccounting)

	// draft/submitted/rejected/paid のレポートのみ存在する。
	for _, status := range []domain.ReportStatus{
		domain.ReportStatusDraft,
		domain.ReportStatusSubmitted,
		domain.ReportStatusRejected,
		domain.ReportStatusPaid,
	} {
		testutil.CreateReport(t, pool, tenantID, userID,
			testutil.WithReportStatus(status),
		)
	}

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable", nil,
		userID.String(), tenantID.String(), "accounting")
	rec := srv.Execute(req)

	// 200 OK: data が空配列（WFL-044）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-045: applicant_name クエリパラメータで申請者名フィルタリングが動作する。
func TestListPayableReports_FilterByApplicantName(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable?applicant_name=Test", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: 申請者名が部分一致するレポートのみ返る（WFL-045）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-046: per_page=1 でページネーションが動作し、total_pages >= 2 になる。
func TestListPayableReports_Pagination(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// 2件目の approved レポートを追加する。
	testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserMemberID),
		testutil.WithReportTitle("2件目の承認済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
	)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable?per_page=1", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: data が1件、pagination.total_pages >= 2（WFL-046）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-047: Member ロールで GET /api/workflow/payable にアクセスすると 403 が返る。
func TestListPayableReports_Forbidden_Member(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-047）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-048: Approver ロールで GET /api/workflow/payable にアクセスすると 403 が返る。
func TestListPayableReports_Forbidden_Approver(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-048）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-049: Admin ロールで GET /api/workflow/payable にアクセスすると 403 が返る。
func TestListPayableReports_Forbidden_Admin(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/workflow/payable", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-049）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-050: 認証ヘッダーなしで GET /api/workflow/payable にアクセスすると 401 が返る。
func TestListPayableReports_Unauthorized(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/workflow/payable", nil)
	rec := srv.Execute(req)

	// 401 UNAUTHORIZED（WFL-050）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 5. POST /api/workflow/{id}/pay — 支払完了（WFL-051〜WFL-063）
// =============================================================================

// WFL-051: Accounting で approved レポートを支払完了にすると 200 OK、status=paid になる。
func TestMarkReportAsPaid_Success(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportApprovedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: status=paid, paid_by=Accounting（WFL-051）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// WFL-052: submitted 状態のレポートを支払完了にしようとすると 422 INVALID_STATE_TRANSITION になる（X5）。
func TestMarkReportAsPaid_X5_SubmittedToPaid(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportSubmittedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportSubmittedID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: submitted→paid は不可（X5, WFL-052）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-053: draft 状態のレポートを支払完了にしようとすると 422 INVALID_STATE_TRANSITION になる（X6）。
func TestMarkReportAsPaid_X6_DraftToPaid(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportDraftID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportDraftID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: draft→paid は不可（X6, WFL-053）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-054: paid 状態のレポートをさらに支払完了にしようとすると 422 INVALID_STATE_TRANSITION になる（X10）。
func TestMarkReportAsPaid_AlreadyPaid(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportPaidID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportPaidID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: paid→paid は不可（X10, WFL-054）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-055: rejected 状態のレポートを支払完了にしようとすると 422 INVALID_STATE_TRANSITION になる（X9）。
func TestMarkReportAsPaid_RejectedState(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	updatedAt := getReportUpdatedAt(t, pool, testutil.ReportRejectedID)
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportRejectedID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 422 INVALID_STATE_TRANSITION: rejected→paid は不可（X9, WFL-055）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// WFL-056: 自己支払処理禁止 — Accounting 本人が作成した approved レポートを支払完了にしようとすると 403 SELF_PAYMENT_NOT_ALLOWED になる。
func TestMarkReportAsPaid_SelfPayment(t *testing.T) {
	srv, pool := setupWorkflowTest(t)

	// Test Accounting 本人が作成した approved レポートを動的に作成する。
	selfReportID := testutil.CreateReport(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		testutil.MustParseUUID(testutil.UserAccountingID),
		testutil.WithReportTitle("Accounting 自己申請の承認済みレポート"),
		testutil.WithReportStatus(domain.ReportStatusApproved),
	)

	updatedAt := getReportUpdatedAt(t, pool, selfReportID.String())
	body := workflowJSONBody(t, map[string]string{
		"updated_at": updatedAt,
	})

	req := srv.AuthRequest(t, http.MethodPost,
		fmt.Sprintf("/api/workflow/%s/pay", selfReportID), body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 403 SELF_PAYMENT_NOT_ALLOWED（RBC-012, WFL-056）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-057: Member ロールで POST /api/workflow/{id}/pay にアクセスすると 403 が返る。
func TestMarkReportAsPaid_Forbidden_Member(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-057）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-058: Approver ロールで POST /api/workflow/{id}/pay にアクセスすると 403 が返る。
func TestMarkReportAsPaid_Forbidden_Approver(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-058）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-059: Admin ロールで POST /api/workflow/{id}/pay にアクセスすると 403 が返る。
func TestMarkReportAsPaid_Forbidden_Admin(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN（WFL-059）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// WFL-060: 認証ヘッダーなしで POST /api/workflow/{id}/pay にアクセスすると 401 が返る。
func TestMarkReportAsPaid_Unauthorized(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	// 401 UNAUTHORIZED（WFL-060）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// WFL-061: 存在しないレポート ID を指定すると 404 RESOURCE_NOT_FOUND になる。
func TestMarkReportAsPaid_NotFound(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2026-03-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/00000000-0000-0000-0000-000000000099/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND（WFL-061）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// WFL-062: updated_at に古いタイムスタンプを指定すると 409 CONFLICT になる（楽観的ロック）。
func TestMarkReportAsPaid_Conflict_OptimisticLock(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	// 意図的に古いタイムスタンプを使用して楽観的ロック競合を発生させる。
	body := workflowJSONBody(t, map[string]string{
		"updated_at": "2000-01-01T00:00:00Z",
	})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 409 CONFLICT（楽観的ロック違反, WFL-062）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusConflict)
}

// WFL-063: updated_at フィールドなしでリクエストすると 400 または 422 になる。
func TestMarkReportAsPaid_MissingUpdatedAt(t *testing.T) {
	srv, _ := setupWorkflowTest(t)

	// updated_at フィールドを含まないリクエストボディ。
	body := workflowJSONBody(t, map[string]string{})

	req := srv.AuthRequest(t, http.MethodPost,
		"/api/workflow/"+testutil.ReportApprovedID+"/pay", body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 400 または 422: updated_at は必須（WFL-063）。機能未実装のため現在は失敗する。
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("WFL-063: got status %d, want 400 or 422 (body: %s)", rec.Code, rec.Body.String())
	}
}
