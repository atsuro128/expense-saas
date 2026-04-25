//go:build integration

// tenant_handler_test.go はテナント管理エンドポイントの統合テスト。
// テストケース: TNT-001〜TNT-011（tenant.md 参照）

package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupTenantTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupTenantTest(t *testing.T) *testutil.TestServer {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	return testutil.NewTestServer(t, pool)
}

// =============================================================================
// GET /api/tenant（getTenant）
// =============================================================================

// TestGetTenant_Admin_OK: TNT-001 - Admin で GET /api/tenant → 200
func TestGetTenant_Admin_OK(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Admin JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserAdminID, testutil.TenantAID, "admin")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 200 OK
	testutil.AssertStatus(t, rec, http.StatusOK)

	// 検証: レスポンスボディ
	var resp struct {
		Data struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			CreatedAt string `json:"created_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}

	// data.id がテナントA の UUID と一致すること
	if resp.Data.ID != testutil.TenantAID {
		t.Errorf("data.id: got %q, want %q", resp.Data.ID, testutil.TenantAID)
	}

	// data.name が "Test Company A" と一致すること
	if resp.Data.Name != "Test Company A" {
		t.Errorf("data.name: got %q, want %q", resp.Data.Name, "Test Company A")
	}

	// data.created_at が RFC3339 形式の文字列であること
	if resp.Data.CreatedAt == "" {
		t.Error("data.created_at が空です")
	}
	if _, err := time.Parse(time.RFC3339, resp.Data.CreatedAt); err != nil {
		t.Errorf("data.created_at が RFC3339 形式ではありません: %q, err: %v", resp.Data.CreatedAt, err)
	}
}

// TestGetTenant_Unauthenticated: TNT-002 - Authorization ヘッダーなしで GET /api/tenant → 401
func TestGetTenant_Unauthenticated(t *testing.T) {
	srv := setupTenantTest(t)

	// Authorization ヘッダーなしでリクエスト
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}

	rec := srv.Execute(req)

	// 検証: 401 UNAUTHORIZED
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// TestGetTenant_Approver_Forbidden: TNT-003 - Approver で GET /api/tenant → 403
func TestGetTenant_Approver_Forbidden(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Approver JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserApproverID, testutil.TenantAID, "approver")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 403 FORBIDDEN
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}

// TestGetTenant_Member_Forbidden: TNT-004 - Member で GET /api/tenant → 403
func TestGetTenant_Member_Forbidden(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Member JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserMemberID, testutil.TenantAID, "member")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 403 FORBIDDEN
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}

// TestGetTenant_Accounting_Forbidden: TNT-005 - Accounting で GET /api/tenant → 403
func TestGetTenant_Accounting_Forbidden(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Accounting JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserAccountingID, testutil.TenantAID, "accounting")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 403 FORBIDDEN
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}

// =============================================================================
// GET /api/tenant/members（listTenantMembers）
// =============================================================================

// TestListTenantMembers_Admin_OK: TNT-006 - Admin で GET /api/tenant/members → 200
func TestListTenantMembers_Admin_OK(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントAに Admin, Approver, Member, Accounting, Member Empty の 5 ユーザーが登録済み（SeedFixtures による）
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant/members", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserAdminID, testutil.TenantAID, "admin")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 200 OK
	testutil.AssertStatus(t, rec, http.StatusOK)

	// 検証: data が配列で 5 件のメンバーが返ること
	var resp struct {
		Data []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}

	// data が配列であること（5 件）
	if len(resp.Data) != 5 {
		t.Errorf("data の件数: got %d, want 5 (body: %s)", len(resp.Data), rec.Body.String())
	}

	// 各要素に id（UUID）と name（文字列）が含まれること
	for i, member := range resp.Data {
		if member.ID == "" {
			t.Errorf("data[%d].id が空です", i)
		}
		if member.Name == "" {
			t.Errorf("data[%d].name が空です", i)
		}
	}
}

// TestListTenantMembers_Accounting_OK: TNT-007 - Accounting で GET /api/tenant/members → 200
func TestListTenantMembers_Accounting_OK(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Accounting JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant/members", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserAccountingID, testutil.TenantAID, "accounting")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 200 OK
	testutil.AssertStatus(t, rec, http.StatusOK)

	// 検証: data が配列でテナントA の全メンバーが返ること
	var resp struct {
		Data []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}

	if len(resp.Data) == 0 {
		t.Error("data が空です。テナントA のメンバーが返ることを期待します")
	}
}

// TestListTenantMembers_ReturnsOwnTenantOnly: TNT-008 - テナント分離検証
func TestListTenantMembers_ReturnsOwnTenantOnly(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントBにも別ユーザー（UserMemberBID）が登録済み（SeedFixtures による）
	// Admin（テナントA）で GET /api/tenant/members を実行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant/members", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserAdminID, testutil.TenantAID, "admin")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 200 OK
	testutil.AssertStatus(t, rec, http.StatusOK)

	var resp struct {
		Data []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("レスポンスの JSON デコードに失敗しました: %v (body: %s)", err, rec.Body.String())
	}

	// テナントBのユーザー（UserMemberBID）が含まれないこと
	for _, member := range resp.Data {
		if member.ID == testutil.UserMemberBID {
			t.Errorf("テナントBのユーザー %q がレスポンスに含まれています（テナント分離違反）", testutil.UserMemberBID)
		}
	}

	// テナントAのメンバーのみが含まれること（5 件）
	tenantAMemberIDs := map[string]bool{
		testutil.UserAdminID:      true,
		testutil.UserApproverID:   true,
		testutil.UserMemberID:     true,
		testutil.UserAccountingID: true,
		testutil.UserMemberEmptyID: true,
	}
	for _, member := range resp.Data {
		if !tenantAMemberIDs[member.ID] {
			t.Errorf("テナントA に属さないユーザー %q がレスポンスに含まれています", member.ID)
		}
	}
}

// TestListTenantMembers_Unauthenticated: TNT-009 - Authorization ヘッダーなしで GET /api/tenant/members → 401
func TestListTenantMembers_Unauthenticated(t *testing.T) {
	srv := setupTenantTest(t)

	// Authorization ヘッダーなしでリクエスト
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant/members", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}

	rec := srv.Execute(req)

	// 検証: 401 UNAUTHORIZED
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// TestListTenantMembers_Approver_Forbidden: TNT-010 - Approver で GET /api/tenant/members → 403
func TestListTenantMembers_Approver_Forbidden(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Approver JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant/members", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserApproverID, testutil.TenantAID, "approver")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 403 FORBIDDEN
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}

// TestListTenantMembers_Member_Forbidden: TNT-011 - Member で GET /api/tenant/members → 403
func TestListTenantMembers_Member_Forbidden(t *testing.T) {
	srv := setupTenantTest(t)

	// 前提: テナントA の Member JWT を発行
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/api/tenant/members", nil)
	if err != nil {
		t.Fatalf("リクエスト生成に失敗しました: %v", err)
	}
	token := testutil.GenerateTestToken(t, testutil.UserMemberID, testutil.TenantAID, "member")
	req.Header.Set("Authorization", "Bearer "+token)

	rec := srv.Execute(req)

	// 検証: 403 FORBIDDEN
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}
