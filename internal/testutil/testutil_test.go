//go:build integration

package testutil_test

import (
	"testing"

	"expense-saas/internal/testutil"
)

// TestSetupTestDB はテスト DB pool の生成と疎通確認を検証する。
func TestSetupTestDB(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	if pool == nil {
		t.Fatal("expected non-nil pool")
	}
}

// TestSeedFixtures は標準フィクスチャがエラーなく挿入できることを検証する。
func TestSeedFixtures(t *testing.T) {
	pool := testutil.SetupTestDB(t)

	testutil.RunMigrations(t, pool.Config().ConnString())

	testutil.CleanupTables(t, pool)
	t.Cleanup(func() {
		testutil.CleanupTables(t, pool)
	})

	testutil.SeedFixtures(t, pool)
}

// TestGenerateTestToken はテスト用 JWT の生成と検証ができることを確認する。
func TestGenerateTestToken(t *testing.T) {
	token := testutil.GenerateTestToken(t, testutil.UserMemberID, testutil.TenantAID, "member")
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	verifier := testutil.TestVerifier(t)
	claims, err := verifier.Verify(token)
	if err != nil {
		t.Fatalf("TestVerifier.Verify: %v", err)
	}

	if claims.UserID != testutil.UserMemberID {
		t.Errorf("UserID: got %q, want %q", claims.UserID, testutil.UserMemberID)
	}
	if claims.TenantID != testutil.TenantAID {
		t.Errorf("TenantID: got %q, want %q", claims.TenantID, testutil.TenantAID)
	}
	if claims.Role != "member" {
		t.Errorf("Role: got %q, want %q", claims.Role, "member")
	}
}
