//go:build integration

package testutil_test

import (
	"testing"

	"expense-saas/internal/testutil"
)

// TestSetupTestDB verifies that the test DB pool can be created and pinged.
func TestSetupTestDB(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	if pool == nil {
		t.Fatal("expected non-nil pool")
	}
}

// TestSeedFixtures verifies that standard fixtures can be inserted without error.
func TestSeedFixtures(t *testing.T) {
	pool := testutil.SetupTestDB(t)

	testutil.RunMigrations(t, pool.Config().ConnString())

	testutil.CleanupTables(t, pool)
	t.Cleanup(func() {
		testutil.CleanupTables(t, pool)
	})

	testutil.SeedFixtures(t, pool)
}

// TestGenerateTestToken verifies that the test JWT can be generated and verified.
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
