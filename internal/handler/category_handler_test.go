package handler_test

// DSH-019〜DSH-025: カテゴリ一覧取得エンドポイントの統合テスト。
// GET /api/categories のハンドラ（listCategories）を対象とする。

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"expense-saas/internal/testutil"
)

// categoryItem は GET /api/categories のレスポンス内の 1 件分のカテゴリ。
type categoryItem struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	NameJa    string `json:"name_ja"`
	SortOrder int    `json:"sort_order"`
}

// categoryListResponse は GET /api/categories のレスポンスボディ構造。
type categoryListResponse struct {
	Data []categoryItem `json:"data"`
}

// =============================================================================
// DSH-019〜DSH-021: 正常系テスト
// =============================================================================

// TestListCategories_OK_Member は Member ロールでカテゴリ一覧が取得できることを検証する。
// DSH-019 に対応する。
func TestListCategories_OK_Member(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/categories", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp categoryListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if len(resp.Data) == 0 {
		t.Fatal("カテゴリ一覧が空です")
	}

	// 各要素に必須フィールドが存在することを確認する。
	for i, cat := range resp.Data {
		if cat.ID == "" {
			t.Errorf("カテゴリ[%d].id が空です", i)
		}
		if cat.Code == "" {
			t.Errorf("カテゴリ[%d].code が空です", i)
		}
		if cat.NameJa == "" {
			t.Errorf("カテゴリ[%d].name_ja が空です", i)
		}
	}
}

// TestListCategories_ContainsStandardCategories は標準 6 種類のカテゴリが含まれることを検証する。
// DSH-020 に対応する。
func TestListCategories_ContainsStandardCategories(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/categories", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp categoryListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	// マイグレーションシードで定義された標準 6 カテゴリコード。
	standardCodes := []string{
		"transportation",
		"accommodation",
		"food",
		"supplies",
		"communication",
		"other",
	}

	codeSet := make(map[string]bool, len(resp.Data))
	for _, cat := range resp.Data {
		codeSet[cat.Code] = true
	}

	for _, code := range standardCodes {
		if !codeSet[code] {
			t.Errorf("標準カテゴリ %q がレスポンスに含まれていません", code)
		}
	}
}

// TestListCategories_SortedBySortOrder はカテゴリが sort_order 昇順で返ることを検証する。
// DSH-021 に対応する。
func TestListCategories_SortedBySortOrder(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/categories", nil,
		testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp categoryListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("JSON デコードに失敗しました: %v", err)
	}

	if len(resp.Data) < 2 {
		t.Skip("カテゴリが 2 件未満のため sort_order 順序検証をスキップします")
	}

	for i := 1; i < len(resp.Data); i++ {
		if resp.Data[i-1].SortOrder > resp.Data[i].SortOrder {
			t.Errorf("sort_order が昇順でありません: index %d (%d) > index %d (%d)",
				i-1, resp.Data[i-1].SortOrder, i, resp.Data[i].SortOrder)
		}
	}
}

// =============================================================================
// DSH-022〜DSH-025: 認可テスト
// =============================================================================

// TestListCategories_OK_Approver は Approver ロールでカテゴリ一覧が取得できることを検証する。
// DSH-022 に対応する。
func TestListCategories_OK_Approver(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/categories", nil,
		testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestListCategories_OK_Accounting は Accounting ロールでカテゴリ一覧が取得できることを検証する。
// DSH-023 に対応する。
func TestListCategories_OK_Accounting(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/categories", nil,
		testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestListCategories_OK_Admin は Admin ロールでカテゴリ一覧が取得できることを検証する。
// DSH-024 に対応する。
func TestListCategories_OK_Admin(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req := srv.AuthRequest(t, http.MethodGet, "/api/categories", nil,
		testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	testutil.AssertStatus(t, rec, http.StatusOK)
}

// TestListCategories_Unauthorized_NoToken は認証トークンなしのリクエストが 401 を返すことを検証する。
// DSH-025 に対応する。
func TestListCategories_Unauthorized_NoToken(t *testing.T) {
	srv, _ := setupDashboardTest(t)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/categories", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}

	rec := srv.Execute(req)
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	testutil.AssertErrorCode(t, rec, "UNAUTHORIZED")
}
