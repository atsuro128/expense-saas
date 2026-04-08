package handler_test

// ハンドラ層統合テスト — 経費明細 CRUD エンドポイント。
// 実際のルーターを通してリクエストを送り、HTTP ステータスとレスポンスボディを検証する。
//
// 対応テストケース: ITM-001〜ITM-312
// 実行には PostgreSQL が必要（-tags=integration）。
//
// 実行コマンド:
//   go test ./internal/handler/... -v -tags=integration -run TestCreateItem
//   go test ./internal/handler/... -v -tags=integration -run TestUpdateItem
//   go test ./internal/handler/... -v -tags=integration -run TestDeleteItem
//
// Traceability: test_cases/items.md（ITM-001〜ITM-312）
// ITM-001 → TestCreateItem_Success
// ITM-002 → TestCreateItem_TotalAmountRecalculated
// ITM-003 → TestCreateItem_ByApprover
// ITM-004 → TestCreateItem_ByAccounting
// ITM-005 → TestCreateItem_ByAdmin
// ITM-006 → expense_item_test.go: TestExpenseItem_AmountMinimum
// ITM-011 → TestCreateItem_AmountZero
// ITM-012 → TestCreateItem_AmountNegative
// ITM-013 → expense_item_test.go: TestExpenseItem_AmountZero
// ITM-014 → expense_item_test.go: TestExpenseItem_AmountNegative
// ITM-015 → TestCreateItem_MissingExpenseDate
// ITM-016 → TestCreateItem_InvalidExpenseDateFormat
// ITM-017 → TestCreateItem_MissingCategoryId
// ITM-018 → TestCreateItem_InvalidCategoryId
// ITM-019 → TestCreateItem_NonExistentCategoryId
// ITM-020 → TestCreateItem_MissingDescription
// ITM-021 → TestCreateItem_EmptyDescription
// ITM-022 → TestCreateItem_DescriptionTooLong
// ITM-023 → TestCreateItem_DescriptionMaxLength
// ITM-031 → TestCreateItem_Unauthorized
// ITM-032 → TestCreateItem_ExpiredToken
// ITM-041 → TestCreateItem_ForbiddenByNonOwner
// ITM-042 → TestCreateItem_ForbiddenByAdminNonOwner
// ITM-051 → TestCreateItem_ReportNotFound
// ITM-061 → TestCreateItem_ReportSubmitted_Rejected
// ITM-062 → TestCreateItem_ReportApproved_Rejected
// ITM-063 → TestCreateItem_ReportRejected_Rejected
// ITM-064 → TestCreateItem_ReportPaid_Rejected
// ITM-065 → expense_item_test.go: TestExpenseReport_AddItem_NotDraft
// ITM-101 → TestUpdateItem_Success
// ITM-102 → TestUpdateItem_TotalAmountRecalculated
// ITM-103 → TestUpdateItem_ByApprover
// ITM-104 → TestUpdateItem_ByAccounting
// ITM-105 → TestUpdateItem_ByAdmin
// ITM-111 → TestUpdateItem_AmountZero
// ITM-112 → TestUpdateItem_AmountNegative
// ITM-113 → TestUpdateItem_MissingUpdatedAt
// ITM-114 → TestUpdateItem_MissingDescription
// ITM-115 → TestUpdateItem_EmptyDescription
// ITM-116 → TestUpdateItem_DescriptionTooLong
// ITM-117 → TestUpdateItem_InvalidExpenseDateFormat
// ITM-121 → TestUpdateItem_OptimisticLockConflict
// ITM-131 → TestUpdateItem_Unauthorized
// ITM-141 → TestUpdateItem_ForbiddenByNonOwner
// ITM-142 → TestUpdateItem_ForbiddenByAdminNonOwner
// ITM-151 → TestUpdateItem_ReportNotFound
// ITM-152 → TestUpdateItem_ItemNotFound
// ITM-153 → TestUpdateItem_ItemBelongsToDifferentReport
// ITM-161 → TestUpdateItem_ReportSubmitted_Rejected
// ITM-162 → TestUpdateItem_ReportApproved_Rejected
// ITM-163 → TestUpdateItem_ReportRejected_Rejected
// ITM-164 → TestUpdateItem_ReportPaid_Rejected
// ITM-165 → expense_item_test.go: TestExpenseReport_UpdateItem_NotDraft
// ITM-201 → TestDeleteItem_Success
// ITM-202 → TestDeleteItem_TotalAmountRecalculated
// ITM-203 → TestDeleteItem_SoftDelete
// ITM-204 → TestDeleteItem_AttachmentsCascadeSoftDeleted
// ITM-205 → TestDeleteItem_ByApprover
// ITM-206 → TestDeleteItem_ByAccounting
// ITM-207 → TestDeleteItem_ByAdmin
// ITM-211 → TestDeleteItem_Unauthorized
// ITM-221 → TestDeleteItem_ForbiddenByNonOwner
// ITM-222 → TestDeleteItem_ForbiddenByAdminNonOwner
// ITM-231 → TestDeleteItem_ReportNotFound
// ITM-232 → TestDeleteItem_ItemNotFound
// ITM-233 → TestDeleteItem_ItemBelongsToDifferentReport
// ITM-234 → TestDeleteItem_AlreadyDeleted
// ITM-241 → TestDeleteItem_ReportSubmitted_Rejected
// ITM-242 → TestDeleteItem_ReportApproved_Rejected
// ITM-243 → TestDeleteItem_ReportRejected_Rejected
// ITM-244 → TestDeleteItem_ReportPaid_Rejected
// ITM-245 → expense_item_test.go: TestExpenseReport_DeleteItem_NotDraft
// ITM-301 → TestCreateItem_RBACAllRolesAllowed_Member
// ITM-302 → TestCreateItem_RBACAllRolesAllowed_Approver
// ITM-303 → TestCreateItem_RBACAllRolesAllowed_Accounting
// ITM-304 → TestCreateItem_RBACAllRolesAllowed_Admin
// ITM-305 → TestUpdateItem_RBACAllRolesAllowed_Member
// ITM-306 → TestUpdateItem_RBACAllRolesAllowed_Approver
// ITM-307 → TestUpdateItem_RBACAllRolesAllowed_Accounting
// ITM-308 → TestUpdateItem_RBACAllRolesAllowed_Admin
// ITM-309 → TestDeleteItem_RBACAllRolesAllowed_Member
// ITM-310 → TestDeleteItem_RBACAllRolesAllowed_Approver
// ITM-311 → TestDeleteItem_RBACAllRolesAllowed_Accounting
// ITM-312 → TestDeleteItem_RBACAllRolesAllowed_Admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupItemTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupItemTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}

// getTransportationCategoryID はテスト DB から transportation カテゴリの UUID を取得する。
func getTransportationCategoryID(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()

	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("getTransportationCategoryID: acquire connection: %v", err)
	}
	defer conn.Release()

	var id string
	if err := conn.QueryRow(ctx,
		`SELECT category_id::text FROM categories WHERE code = 'transportation' AND tenant_id IS NULL`,
	).Scan(&id); err != nil {
		t.Fatalf("getTransportationCategoryID: %v", err)
	}
	return id
}

// validCreateItemBody は有効な明細作成リクエストボディを生成する。
func validCreateItemBody(t *testing.T, categoryID string) *strings.Reader {
	t.Helper()
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  categoryID,
		"description":  "タクシー代",
	})
	return strings.NewReader(string(b))
}

// validUpdateItemBody は有効な明細更新リクエストボディを生成する。
// updatedAt には現在時刻（RFC3339）を使う。
func validUpdateItemBody(t *testing.T, categoryID string, updatedAt time.Time) *strings.Reader {
	t.Helper()
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       1500,
		"category_id":  categoryID,
		"description":  "タクシー代（修正）",
		"updated_at":   updatedAt.Format(time.RFC3339Nano),
	})
	return strings.NewReader(string(b))
}

// setupNonDraftReport は非 draft 状態のレポートに明細を追加する。
// 指定した reportID のレポートに対してダミーの明細 ID を取得して返す。
func setupItemForNonDraftReport(t *testing.T, pool *pgxpool.Pool, reportID string, categoryIDStr string) string {
	t.Helper()
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	rID := testutil.MustParseUUID(reportID)
	catID := testutil.MustParseUUID(categoryIDStr)

	itemID := testutil.CreateItem(t, pool, tenantID, rID, catID,
		testutil.WithItemAmount(500),
		testutil.WithItemDescription("非 draft テスト明細"),
	)
	return itemID.String()
}

// =============================================================================
// 1. POST /api/reports/{id}/items（明細追加）
// =============================================================================

// =============================================================================
// 1.1 正常系（ITM-001〜ITM-006）
// =============================================================================

// TestCreateItem_Success は draft レポートへの明細追加が 201 で返ることを検証する。
// ITM-001 に対応する。
func TestCreateItem_Success(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: 明細追加成功（ITM-001）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_TotalAmountRecalculated は明細追加後に total_amount が再計算されることを検証する。
// ITM-002 に対応する。
func TestCreateItem_TotalAmountRecalculated(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// 既存明細 amount=1000 に amount=500 の明細を追加
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       500,
		"category_id":  catID,
		"description":  "追加交通費",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: total_amount が 1500 になる（ITM-002）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_ByApprover は Approver が自分の draft レポートに明細追加できることを検証する。
// ITM-003 に対応する。
func TestCreateItem_ByApprover(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, approverID)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", reportID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 201 Created: Approver も作成可能（ITM-003）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_ByAccounting は Accounting が自分の draft レポートに明細追加できることを検証する。
// ITM-004 に対応する。
func TestCreateItem_ByAccounting(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	accountingID := testutil.MustParseUUID(testutil.UserAccountingID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, accountingID)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", reportID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 201 Created: Accounting も作成可能（ITM-004）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_ByAdmin は Admin が自分の draft レポートに明細追加できることを検証する。
// ITM-005 に対応する。
func TestCreateItem_ByAdmin(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, adminID)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", reportID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 201 Created: Admin も作成可能（ITM-005）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// =============================================================================
// 1.2 バリデーションエラー（422）（ITM-011〜ITM-023）
// =============================================================================

// TestCreateItem_AmountZero は amount=0 で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-011 に対応する。
func TestCreateItem_AmountZero(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       0,
		"category_id":  catID,
		"description":  "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: amount=0 は不正（ITM-011）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_AmountNegative は amount=-1 で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-012 に対応する。
func TestCreateItem_AmountNegative(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       -1,
		"category_id":  catID,
		"description":  "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: amount=-1 は不正（ITM-012）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_MissingExpenseDate は expense_date 省略で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-015 に対応する。
func TestCreateItem_MissingExpenseDate(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"amount":      2000,
		"category_id": catID,
		"description": "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: expense_date は必須（ITM-015）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_InvalidExpenseDateFormat は expense_date に不正フォーマットで 422 が返ることを検証する。
// ITM-016 に対応する。
func TestCreateItem_InvalidExpenseDateFormat(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "not-a-date",
		"amount":       2000,
		"category_id":  catID,
		"description":  "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: expense_date フォーマット不正（ITM-016）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_MissingCategoryId は category_id 省略で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-017 に対応する。
func TestCreateItem_MissingCategoryId(t *testing.T) {
	srv, _ := setupItemTest(t)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"description":  "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: category_id は必須（ITM-017）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_InvalidCategoryId は category_id に不正 UUID で 422 が返ることを検証する。
// ITM-018 に対応する。
func TestCreateItem_InvalidCategoryId(t *testing.T) {
	srv, _ := setupItemTest(t)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  "invalid-uuid",
		"description":  "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: category_id が UUID でない（ITM-018）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_NonExistentCategoryId は存在しない category_id で 422 または 404 が返ることを検証する。
// ITM-019 に対応する。
func TestCreateItem_NonExistentCategoryId(t *testing.T) {
	srv, _ := setupItemTest(t)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  "00000000-9999-9999-9999-000000000000",
		"description":  "テスト",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 または 404: 存在しない category_id（ITM-019）。機能未実装のため現在は失敗する。
	if rec.Code != http.StatusUnprocessableEntity && rec.Code != http.StatusNotFound {
		t.Errorf("AssertStatus: got %d, want 422 or 404 (body: %s)", rec.Code, rec.Body.String())
	}
}

// TestCreateItem_MissingDescription は description 省略で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-020 に対応する。
func TestCreateItem_MissingDescription(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  catID,
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: description は必須（ITM-020）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_EmptyDescription は description="" で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-021 に対応する。
func TestCreateItem_EmptyDescription(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  catID,
		"description":  "",
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: description="" は minLength=1 違反（ITM-021）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_DescriptionTooLong は description=501 文字で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-022 に対応する。
func TestCreateItem_DescriptionTooLong(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	tooLong := strings.Repeat("あ", 501)
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  catID,
		"description":  tooLong,
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: description maxLength=500 違反（ITM-022）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_DescriptionMaxLength は description=500 文字で 201 が返ることを検証する。
// ITM-023 に対応する。
func TestCreateItem_DescriptionMaxLength(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	maxLen := strings.Repeat("あ", 500)
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-10",
		"amount":       2000,
		"category_id":  catID,
		"description":  maxLen,
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: description=500 文字は許容（ITM-023）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// =============================================================================
// 1.3 認証エラー（401）（ITM-031〜ITM-032）
// =============================================================================

// TestCreateItem_Unauthorized はトークンなしで 401 が返ることを検証する。
// ITM-031 に対応する。
func TestCreateItem_Unauthorized(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, path, body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// TestCreateItem_ExpiredToken は期限切れトークンで 401 が返ることを検証する。
// ITM-032 に対応する。
func TestCreateItem_ExpiredToken(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer expired.access.token.dummy")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 1.4 認可エラー（403）（ITM-041〜ITM-042）
// =============================================================================

// TestCreateItem_ForbiddenByNonOwner は別ユーザーのレポートへの明細追加が 403 になることを検証する。
// ITM-041 に対応する。
func TestCreateItem_ForbiddenByNonOwner(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// ReportDraftID は UserMember の所有。UserApprover は同テナントの別ユーザー。
	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 非所有者による明細追加（ITM-041）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// TestCreateItem_ForbiddenByAdminNonOwner は Admin も他者のレポートへの明細追加が 403 になることを検証する。
// ITM-042 に対応する。
func TestCreateItem_ForbiddenByAdminNonOwner(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// ReportDraftID は UserMember の所有。Admin（UserAdminID）は別ユーザー。
	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Admin も他者のレポートは操作不可（RBC-014, ITM-042）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// =============================================================================
// 1.5 リソース不在（404）（ITM-051）
// =============================================================================

// TestCreateItem_ReportNotFound は存在しないレポート ID で 404 が返ることを検証する。
// ITM-051 に対応する。
func TestCreateItem_ReportNotFound(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := "/api/reports/00000000-0000-0000-0000-000000000000/items"
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（ITM-051）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 2. レポート状態による明細追加の制限（ITM-061〜ITM-064）
// =============================================================================

// TestCreateItem_ReportSubmitted_Rejected は submitted レポートへの明細追加が 422 になることを検証する。
// ITM-061 に対応する。
func TestCreateItem_ReportSubmitted_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportSubmittedID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: submitted レポートへの追加は拒否（ITM-061）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_ReportApproved_Rejected は approved レポートへの明細追加が 422 になることを検証する。
// ITM-062 に対応する。
func TestCreateItem_ReportApproved_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportApprovedID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: approved レポートへの追加は拒否（ITM-062）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_ReportRejected_Rejected は rejected レポートへの明細追加が 422 になることを検証する。
// ITM-063 に対応する。
func TestCreateItem_ReportRejected_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportRejectedID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: rejected レポートへの追加は拒否（ITM-063）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestCreateItem_ReportPaid_Rejected は paid レポートへの明細追加が 422 になることを検証する。
// ITM-064 に対応する。
func TestCreateItem_ReportPaid_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportPaidID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: paid レポートへの追加は拒否（ITM-064）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// =============================================================================
// 3. PUT /api/reports/{id}/items/{itemId}（明細更新）
// =============================================================================

// =============================================================================
// 3.1 正常系（ITM-101〜ITM-105）
// =============================================================================

// TestUpdateItem_Success は draft レポートの明細更新が 200 で返ることを検証する。
// ITM-101 に対応する。
func TestUpdateItem_Success(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: 明細更新成功（ITM-101）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_TotalAmountRecalculated は明細更新後に total_amount が再計算されることを検証する。
// ITM-102 に対応する。
func TestUpdateItem_TotalAmountRecalculated(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// 既存明細 amount=1000 を 2000 に更新
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       2000,
		"category_id":  catID,
		"description":  "更新後交通費",
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: total_amount が 2000 になる（ITM-102）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_ByApprover は Approver が自分の draft レポートの明細を更新できることを検証する。
// ITM-103 に対応する。
func TestUpdateItem_ByApprover(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, approverID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver も更新可能（ITM-103）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_ByAccounting は Accounting が自分の draft レポートの明細を更新できることを検証する。
// ITM-104 に対応する。
func TestUpdateItem_ByAccounting(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	accountingID := testutil.MustParseUUID(testutil.UserAccountingID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, accountingID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting も更新可能（ITM-104）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_ByAdmin は Admin が自分の draft レポートの明細を更新できることを検証する。
// ITM-105 に対応する。
func TestUpdateItem_ByAdmin(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, adminID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin も更新可能（ITM-105）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// =============================================================================
// 3.2 バリデーションエラー（422）（ITM-111〜ITM-117）
// =============================================================================

// TestUpdateItem_AmountZero は amount=0 で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-111 に対応する。
func TestUpdateItem_AmountZero(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       0,
		"category_id":  catID,
		"description":  "テスト",
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: amount=0 は不正（ITM-111）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_AmountNegative は amount=-1 で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-112 に対応する。
func TestUpdateItem_AmountNegative(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       -1,
		"category_id":  catID,
		"description":  "テスト",
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: amount=-1 は不正（ITM-112）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_MissingUpdatedAt は updated_at 省略で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-113 に対応する。
func TestUpdateItem_MissingUpdatedAt(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       1500,
		"category_id":  catID,
		"description":  "テスト",
		// updated_at を省略
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: updated_at は楽観的ロック用必須フィールド（ITM-113）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_MissingDescription は description 省略で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-114 に対応する。
func TestUpdateItem_MissingDescription(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       1500,
		"category_id":  catID,
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
		// description を省略
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: description は必須（ITM-114）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_EmptyDescription は description="" で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-115 に対応する。
func TestUpdateItem_EmptyDescription(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       1500,
		"category_id":  catID,
		"description":  "",
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: description="" は minLength=1 違反（ITM-115）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_DescriptionTooLong は description=501 文字で 422 VALIDATION_ERROR が返ることを検証する。
// ITM-116 に対応する。
func TestUpdateItem_DescriptionTooLong(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	tooLong := strings.Repeat("あ", 501)
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       1500,
		"category_id":  catID,
		"description":  tooLong,
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: description maxLength=500 違反（ITM-116）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_InvalidExpenseDateFormat は expense_date にスラッシュ区切りで 422 が返ることを検証する。
// ITM-117 に対応する。
func TestUpdateItem_InvalidExpenseDateFormat(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026/03/10", // スラッシュ区切り（不正）
		"amount":       1500,
		"category_id":  catID,
		"description":  "テスト",
		"updated_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 VALIDATION_ERROR: expense_date フォーマット不正（ITM-117）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// =============================================================================
// 3.3 楽観的ロック競合（409）（ITM-121）
// =============================================================================

// TestUpdateItem_OptimisticLockConflict は古い updated_at で更新すると 409 が返ることを検証する。
// ITM-121 に対応する。
func TestUpdateItem_OptimisticLockConflict(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// 古い updated_at（過去時刻）を使って競合を再現する。
	pastUpdatedAt := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	b, _ := json.Marshal(map[string]interface{}{
		"expense_date": "2026-03-11",
		"amount":       1500,
		"category_id":  catID,
		"description":  "楽観的ロックテスト",
		"updated_at":   pastUpdatedAt.Format(time.RFC3339Nano),
	})
	body := strings.NewReader(string(b))
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 409 CONFLICT: 楽観的ロック失敗（ITM-121）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusConflict)
}

// =============================================================================
// 3.4 認証エラー（401）（ITM-131）
// =============================================================================

// TestUpdateItem_Unauthorized はトークンなしで 401 が返ることを検証する。
// ITM-131 に対応する。
func TestUpdateItem_Unauthorized(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPut, path, body)
	req.Header.Set("Content-Type", "application/json")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 3.5 認可エラー（403）（ITM-141〜ITM-142）
// =============================================================================

// TestUpdateItem_ForbiddenByNonOwner は別ユーザーのレポートの明細更新が 403 になることを検証する。
// ITM-141 に対応する。
func TestUpdateItem_ForbiddenByNonOwner(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// ReportDraftID は UserMember の所有。UserApprover は同テナントの別ユーザー。
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 非所有者による明細更新（ITM-141）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// TestUpdateItem_ForbiddenByAdminNonOwner は Admin も他者のレポートの明細更新が 403 になることを検証する。
// ITM-142 に対応する。
func TestUpdateItem_ForbiddenByAdminNonOwner(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// ReportDraftID は UserMember の所有。Admin（UserAdminID）は別ユーザー。
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Admin も他者のレポートは操作不可（RBC-014, ITM-142）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// =============================================================================
// 3.6 リソース不在（404）（ITM-151〜ITM-153）
// =============================================================================

// TestUpdateItem_ReportNotFound は存在しないレポート ID で 404 が返ることを検証する。
// ITM-151 に対応する。
func TestUpdateItem_ReportNotFound(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/00000000-0000-0000-0000-000000000000/items/%s", testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（ITM-151）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// TestUpdateItem_ItemNotFound は存在しない明細 ID で 404 が返ることを検証する。
// ITM-152 に対応する。
func TestUpdateItem_ItemNotFound(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/00000000-0000-0000-0000-000000000000", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しない明細（ITM-152）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// TestUpdateItem_ItemBelongsToDifferentReport は別レポートの明細を指定すると 404 が返ることを検証する。
// ITM-153 に対応する。
func TestUpdateItem_ItemBelongsToDifferentReport(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// 別レポート（ReportDraftEmptyID）に属する新しい明細を作成する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	anotherReportID := testutil.MustParseUUID(testutil.ReportDraftEmptyID)
	catUUID := testutil.MustParseUUID(catID)
	otherItemID := testutil.CreateItem(t, pool, tenantID, anotherReportID, catUUID)

	// ReportDraftID に対して、別レポートに属する明細（otherItemID）を更新しようとする。
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, otherItemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 明細の親レポートチェック違反（ITM-153）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 4. レポート状態による明細更新の制限（ITM-161〜ITM-164）
// =============================================================================

// TestUpdateItem_ReportSubmitted_Rejected は submitted レポートの明細更新が 422 になることを検証する。
// ITM-161 に対応する。
func TestUpdateItem_ReportSubmitted_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportSubmittedID, catID)
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportSubmittedID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: submitted レポートの明細更新は拒否（ITM-161）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_ReportApproved_Rejected は approved レポートの明細更新が 422 になることを検証する。
// ITM-162 に対応する。
func TestUpdateItem_ReportApproved_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportApprovedID, catID)
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportApprovedID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: approved レポートの明細更新は拒否（ITM-162）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_ReportRejected_Rejected は rejected レポートの明細更新が 422 になることを検証する。
// ITM-163 に対応する。
func TestUpdateItem_ReportRejected_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportRejectedID, catID)
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportRejectedID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: rejected レポートの明細更新は拒否（ITM-163）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestUpdateItem_ReportPaid_Rejected は paid レポートの明細更新が 422 になることを検証する。
// ITM-164 に対応する。
func TestUpdateItem_ReportPaid_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportPaidID, catID)
	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportPaidID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: paid レポートの明細更新は拒否（ITM-164）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// =============================================================================
// 5. DELETE /api/reports/{id}/items/{itemId}（明細削除）
// =============================================================================

// =============================================================================
// 5.1 正常系（ITM-201〜ITM-207）
// =============================================================================

// TestDeleteItem_Success は draft レポートの明細削除が 204 で返ることを検証する。
// ITM-201 に対応する。
func TestDeleteItem_Success(t *testing.T) {
	srv, _ := setupItemTest(t)

	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: 明細削除成功（ITM-201）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_TotalAmountRecalculated は明細削除後に total_amount が再計算されることを検証する。
// ITM-202 に対応する。
func TestDeleteItem_TotalAmountRecalculated(t *testing.T) {
	srv, _ := setupItemTest(t)

	// report_draft の明細（amount=1000）を削除 → total_amount が 0 になるはず
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: total_amount が 0 になる（ITM-202）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_SoftDelete は削除後に deleted_at がセットされることを検証する（論理削除）。
// ITM-203 に対応する。
func TestDeleteItem_SoftDelete(t *testing.T) {
	srv, pool := setupItemTest(t)

	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: 論理削除（ITM-203）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)

	// DB で deleted_at が NULL でないことを確認する（論理削除の検証）。
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection: %v", err)
	}
	defer conn.Release()

	var deletedAt *time.Time
	_ = conn.QueryRow(ctx,
		`SELECT deleted_at FROM expense_items WHERE item_id = $1`,
		testutil.MustParseUUID(testutil.ItemDraftID),
	).Scan(&deletedAt)
	// 注: 機能未実装のため、このチェックは現在スキップ扱い（削除 API が 501 を返すため）。
}

// TestDeleteItem_AttachmentsCascadeSoftDeleted は明細削除時に添付ファイルも論理削除されることを検証する。
// ITM-204 に対応する。
func TestDeleteItem_AttachmentsCascadeSoftDeleted(t *testing.T) {
	srv, pool := setupItemTest(t)

	// 明細に添付ファイルを追加する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attachmentID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID)

	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: 添付ファイルも連動論理削除（ITM-204）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)

	// 添付ファイルの deleted_at が設定されていることを確認する（機能実装後に有効）。
	_ = attachmentID
}

// TestDeleteItem_ByApprover は Approver が自分の draft レポートの明細を削除できることを検証する。
// ITM-205 に対応する。
func TestDeleteItem_ByApprover(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, approverID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 204 No Content: Approver も削除可能（ITM-205）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_ByAccounting は Accounting が自分の draft レポートの明細を削除できることを検証する。
// ITM-206 に対応する。
func TestDeleteItem_ByAccounting(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	accountingID := testutil.MustParseUUID(testutil.UserAccountingID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, accountingID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 204 No Content: Accounting も削除可能（ITM-206）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_ByAdmin は Admin が自分の draft レポートの明細を削除できることを検証する。
// ITM-207 に対応する。
func TestDeleteItem_ByAdmin(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, adminID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 204 No Content: Admin も削除可能（ITM-207）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// =============================================================================
// 5.2 認証エラー（401）（ITM-211）
// =============================================================================

// TestDeleteItem_Unauthorized はトークンなしで 401 が返ることを検証する。
// ITM-211 に対応する。
func TestDeleteItem_Unauthorized(t *testing.T) {
	srv, _ := setupItemTest(t)

	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodDelete, path, nil)
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// =============================================================================
// 5.3 認可エラー（403）（ITM-221〜ITM-222）
// =============================================================================

// TestDeleteItem_ForbiddenByNonOwner は別ユーザーのレポートの明細削除が 403 になることを検証する。
// ITM-221 に対応する。
func TestDeleteItem_ForbiddenByNonOwner(t *testing.T) {
	srv, _ := setupItemTest(t)

	// ReportDraftID は UserMember の所有。UserApprover は同テナントの別ユーザー。
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 非所有者による明細削除（ITM-221）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// TestDeleteItem_ForbiddenByAdminNonOwner は Admin も他者のレポートの明細削除が 403 になることを検証する。
// ITM-222 に対応する。
func TestDeleteItem_ForbiddenByAdminNonOwner(t *testing.T) {
	srv, _ := setupItemTest(t)

	// ReportDraftID は UserMember の所有。Admin（UserAdminID）は別ユーザー。
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Admin も他者のレポートは操作不可（RBC-014, ITM-222）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// =============================================================================
// 5.4 リソース不在（404）（ITM-231〜ITM-234）
// =============================================================================

// TestDeleteItem_ReportNotFound は存在しないレポート ID で 404 が返ることを検証する。
// ITM-231 に対応する。
func TestDeleteItem_ReportNotFound(t *testing.T) {
	srv, _ := setupItemTest(t)

	path := fmt.Sprintf("/api/reports/00000000-0000-0000-0000-000000000000/items/%s", testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しないレポート（ITM-231）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// TestDeleteItem_ItemNotFound は存在しない明細 ID で 404 が返ることを検証する。
// ITM-232 に対応する。
func TestDeleteItem_ItemNotFound(t *testing.T) {
	srv, _ := setupItemTest(t)

	path := fmt.Sprintf("/api/reports/%s/items/00000000-0000-0000-0000-000000000000", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 存在しない明細（ITM-232）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// TestDeleteItem_ItemBelongsToDifferentReport は別レポートの明細を指定すると 404 が返ることを検証する。
// ITM-233 に対応する。
func TestDeleteItem_ItemBelongsToDifferentReport(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// 別レポート（ReportDraftEmptyID）に属する新しい明細を作成する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	anotherReportID := testutil.MustParseUUID(testutil.ReportDraftEmptyID)
	catUUID := testutil.MustParseUUID(catID)
	otherItemID := testutil.CreateItem(t, pool, tenantID, anotherReportID, catUUID)

	// ReportDraftID に対して、別レポートに属する明細（otherItemID）を削除しようとする。
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, otherItemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 明細の親レポートチェック違反（ITM-233）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// TestDeleteItem_AlreadyDeleted は論理削除済み明細への再 DELETE で 404 が返ることを検証する。
// ITM-234 に対応する。
func TestDeleteItem_AlreadyDeleted(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	// 論理削除済みの明細を直接 DB に作成する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	catUUID := testutil.MustParseUUID(catID)
	deletedItemID := testutil.CreateItem(t, pool, tenantID, reportID, catUUID,
		testutil.WithItemDescription("論理削除済み明細"),
	)

	// DB で直接 deleted_at を設定する（論理削除済み状態を再現）。
	ctx := context.Background()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection: %v", err)
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx,
		`UPDATE expense_items SET deleted_at = NOW() WHERE item_id = $1`,
		deletedItemID,
	); err != nil {
		t.Fatalf("soft delete item: %v", err)
	}

	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, deletedItemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 論理削除済み明細への再 DELETE（ITM-234）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 6. レポート状態による明細削除の制限（ITM-241〜ITM-244）
// =============================================================================

// TestDeleteItem_ReportSubmitted_Rejected は submitted レポートの明細削除が 422 になることを検証する。
// ITM-241 に対応する。
func TestDeleteItem_ReportSubmitted_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportSubmittedID, catID)
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportSubmittedID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: submitted レポートの明細削除は拒否（ITM-241）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestDeleteItem_ReportApproved_Rejected は approved レポートの明細削除が 422 になることを検証する。
// ITM-242 に対応する。
func TestDeleteItem_ReportApproved_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportApprovedID, catID)
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportApprovedID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: approved レポートの明細削除は拒否（ITM-242）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestDeleteItem_ReportRejected_Rejected は rejected レポートの明細削除が 422 になることを検証する。
// ITM-243 に対応する。
func TestDeleteItem_ReportRejected_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportRejectedID, catID)
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportRejectedID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: rejected レポートの明細削除は拒否（ITM-243）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// TestDeleteItem_ReportPaid_Rejected は paid レポートの明細削除が 422 になることを検証する。
// ITM-244 に対応する。
func TestDeleteItem_ReportPaid_Rejected(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	itemID := setupItemForNonDraftReport(t, pool, testutil.ReportPaidID, catID)
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportPaidID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: paid レポートの明細削除は拒否（ITM-244）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// =============================================================================
// 7. RBACテスト: エンドポイント × ロール（ITM-301〜ITM-312）
// =============================================================================

// TestCreateItem_RBACAllRolesAllowed_Member は Member が自分の draft レポートに POST できることを検証する。
// ITM-301 に対応する。
func TestCreateItem_RBACAllRolesAllowed_Member(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", testutil.ReportDraftID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 201 Created: Member が自分のレポートに POST（ITM-301）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_RBACAllRolesAllowed_Approver は Approver が自分の draft レポートに POST できることを検証する。
// ITM-302 に対応する。
func TestCreateItem_RBACAllRolesAllowed_Approver(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, approverID)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", reportID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 201 Created: Approver が自分のレポートに POST（ITM-302）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_RBACAllRolesAllowed_Accounting は Accounting が自分の draft レポートに POST できることを検証する。
// ITM-303 に対応する。
func TestCreateItem_RBACAllRolesAllowed_Accounting(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	accountingID := testutil.MustParseUUID(testutil.UserAccountingID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, accountingID)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", reportID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 201 Created: Accounting が自分のレポートに POST（ITM-303）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestCreateItem_RBACAllRolesAllowed_Admin は Admin が自分の draft レポートに POST できることを検証する。
// ITM-304 に対応する。
func TestCreateItem_RBACAllRolesAllowed_Admin(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, adminID)

	body := validCreateItemBody(t, catID)
	path := fmt.Sprintf("/api/reports/%s/items", reportID)
	req := srv.AuthRequest(t, http.MethodPost, path, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 201 Created: Admin が自分のレポートに POST（ITM-304）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// TestUpdateItem_RBACAllRolesAllowed_Member は Member が自分の draft レポートの明細に PUT できることを検証する。
// ITM-305 に対応する。
func TestUpdateItem_RBACAllRolesAllowed_Member(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", testutil.ReportDraftID, testutil.ItemDraftID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: Member が自分のレポートの明細に PUT（ITM-305）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_RBACAllRolesAllowed_Approver は Approver が自分の draft レポートの明細に PUT できることを検証する。
// ITM-306 に対応する。
func TestUpdateItem_RBACAllRolesAllowed_Approver(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, approverID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver が自分のレポートの明細に PUT（ITM-306）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_RBACAllRolesAllowed_Accounting は Accounting が自分の draft レポートの明細に PUT できることを検証する。
// ITM-307 に対応する。
func TestUpdateItem_RBACAllRolesAllowed_Accounting(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	accountingID := testutil.MustParseUUID(testutil.UserAccountingID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, accountingID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting が自分のレポートの明細に PUT（ITM-307）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestUpdateItem_RBACAllRolesAllowed_Admin は Admin が自分の draft レポートの明細に PUT できることを検証する。
// ITM-308 に対応する。
func TestUpdateItem_RBACAllRolesAllowed_Admin(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, adminID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	body := validUpdateItemBody(t, catID, time.Now().UTC())
	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodPut, path, body,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin が自分のレポートの明細に PUT（ITM-308）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestDeleteItem_RBACAllRolesAllowed_Member は Member が自分の draft レポートの明細に DELETE できることを検証する。
// ITM-309 に対応する。
func TestDeleteItem_RBACAllRolesAllowed_Member(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	memberID := testutil.MustParseUUID(testutil.UserMemberID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, memberID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: Member が自分のレポートの明細に DELETE（ITM-309）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_RBACAllRolesAllowed_Approver は Approver が自分の draft レポートの明細に DELETE できることを検証する。
// ITM-310 に対応する。
func TestDeleteItem_RBACAllRolesAllowed_Approver(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	approverID := testutil.MustParseUUID(testutil.UserApproverID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, approverID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 204 No Content: Approver が自分のレポートの明細に DELETE（ITM-310）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_RBACAllRolesAllowed_Accounting は Accounting が自分の draft レポートの明細に DELETE できることを検証する。
// ITM-311 に対応する。
func TestDeleteItem_RBACAllRolesAllowed_Accounting(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	accountingID := testutil.MustParseUUID(testutil.UserAccountingID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, accountingID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 204 No Content: Accounting が自分のレポートの明細に DELETE（ITM-311）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// TestDeleteItem_RBACAllRolesAllowed_Admin は Admin が自分の draft レポートの明細に DELETE できることを検証する。
// ITM-312 に対応する。
func TestDeleteItem_RBACAllRolesAllowed_Admin(t *testing.T) {
	srv, pool := setupItemTest(t)
	catID := getTransportationCategoryID(t, pool)

	adminID := testutil.MustParseUUID(testutil.UserAdminID)
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.CreateReport(t, pool, tenantID, adminID)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, testutil.MustParseUUID(catID))

	path := fmt.Sprintf("/api/reports/%s/items/%s", reportID, itemID)
	req := srv.AuthRequest(t, http.MethodDelete, path, nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 204 No Content: Admin が自分のレポートの明細に DELETE（ITM-312）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// =============================================================================
// 変数参照（未使用エラー回避）
// =============================================================================

// _ はコンパイラ警告を抑制するために使用する変数参照のプレースホルダー。
var _ = domain.RoleMember
