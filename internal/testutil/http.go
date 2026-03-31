package testutil

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/handler"
	"expense-saas/internal/middleware"
	appjwt "expense-saas/internal/pkg/jwt"
	"expense-saas/internal/repository/postgres"
	"expense-saas/internal/service"
)

// TestServer wraps a chi.Router with test helpers for issuing authenticated HTTP requests.
type TestServer struct {
	Router  http.Handler
	Pool    *pgxpool.Pool
	KeyPair *TestKeyPair
}

// NewTestServer wires up a full application router equivalent to main.go, but
// without rate limiting middleware (which would interfere with tests).
// The router is backed by the given pool; the test JWT key pair is used for auth.
func NewTestServer(t *testing.T, pool *pgxpool.Pool) *TestServer {
	t.Helper()

	kp := GenerateTestKeyPair(t)
	verifier := appjwt.NewVerifierFromKey(kp.PublicKey)

	// Repositories.
	tenantRepo := postgres.NewTenantRepo(pool)
	userRepo := postgres.NewUserRepo(pool)
	membershipRepo := postgres.NewMembershipRepo(pool)
	categoryRepo := postgres.NewCategoryRepo(pool)
	reportRepo := postgres.NewReportRepo(pool)
	itemRepo := postgres.NewItemRepo(pool)
	attachmentRepo := postgres.NewAttachmentRepo(pool)
	refreshTokenRepo := postgres.NewRefreshTokenRepo(pool)
	passwordResetRepo := postgres.NewPasswordResetRepo(pool)

	// Authorizer.
	authorizer := service.NewAuthorizer()

	// Services.
	authSvc := service.NewAuthService(userRepo, tenantRepo, membershipRepo, refreshTokenRepo, passwordResetRepo)
	reportSvc := service.NewReportService(reportRepo, userRepo, membershipRepo, itemRepo, categoryRepo, attachmentRepo, authorizer)
	itemSvc := service.NewItemService(reportRepo, itemRepo, categoryRepo, authorizer)
	attachmentSvc := service.NewAttachmentService(reportRepo, itemRepo, attachmentRepo, authorizer)
	workflowSvc := service.NewWorkflowService(reportRepo, userRepo, membershipRepo, authorizer)
	dashboardSvc := service.NewDashboardService(reportRepo, membershipRepo)
	categorySvc := service.NewCategoryService(categoryRepo)
	tenantSvc := service.NewTenantService(tenantRepo, userRepo, membershipRepo)

	// Handlers.
	authHandler := handler.NewAuthHandler(authSvc)
	reportHandler := handler.NewReportHandler(reportSvc)
	itemHandler := handler.NewItemHandler(itemSvc)
	attachmentHandler := handler.NewAttachmentHandler(attachmentSvc)
	workflowHandler := handler.NewWorkflowHandler(workflowSvc)
	dashboardHandler := handler.NewDashboardHandler(dashboardSvc)
	categoryHandler := handler.NewCategoryHandler(categorySvc)
	tenantHandler := handler.NewTenantHandler(tenantSvc)

	// Router (no rate limiting, no CORS in tests).
	r := chi.NewRouter()
	r.Use(middleware.RequestID)

	// Unauthenticated routes.
	r.Group(func(pub chi.Router) {
		pub.Get("/health", handler.NewHealthHandler(pool))

		pub.Post("/api/auth/signup", authHandler.Signup)
		pub.Post("/api/auth/login", authHandler.Login)
		pub.Post("/api/auth/refresh", authHandler.RefreshToken)
		pub.Post("/api/auth/logout", authHandler.Logout)
		pub.Post("/api/auth/password-reset", authHandler.RequestPasswordReset)
		pub.Put("/api/auth/password-reset/{token}", authHandler.ExecutePasswordReset)
	})

	// Authenticated group.
	r.Group(func(priv chi.Router) {
		priv.Use(middleware.Auth(verifier))
		priv.Use(middleware.TenantContext(pool))

		// All authenticated roles.
		priv.With(middleware.RequireRole("member", "approver", "admin", "accounting")).Group(func(all chi.Router) {
			all.Get("/api/auth/me", authHandler.GetMe)
			all.Get("/api/dashboard", dashboardHandler.GetDashboard)
			all.Get("/api/categories", categoryHandler.ListCategories)

			// Reports.
			all.Get("/api/reports", reportHandler.ListMyReports)
			all.Post("/api/reports", reportHandler.CreateReport)
			all.Get("/api/reports/{id}", reportHandler.GetReport)
			all.Put("/api/reports/{id}", reportHandler.UpdateReport)
			all.Delete("/api/reports/{id}", reportHandler.DeleteReport)
			all.Post("/api/reports/{id}/submit", reportHandler.SubmitReport)

			// Items.
			all.Post("/api/reports/{id}/items", itemHandler.CreateItem)
			all.Put("/api/reports/{id}/items/{itemId}", itemHandler.UpdateItem)
			all.Delete("/api/reports/{id}/items/{itemId}", itemHandler.DeleteItem)

			// Attachments.
			all.Post("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.UploadAttachment)
			all.Get("/api/reports/{id}/items/{itemId}/attachments", attachmentHandler.ListAttachments)
			all.Get("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.GetAttachmentDownload)
			all.Delete("/api/reports/{id}/items/{itemId}/attachments/{attId}", attachmentHandler.DeleteAttachment)
		})

		// Approver only.
		priv.With(middleware.RequireRole("approver")).Group(func(approver chi.Router) {
			approver.Get("/api/workflow/pending", workflowHandler.ListPendingReports)
			approver.Post("/api/workflow/{id}/approve", workflowHandler.ApproveReport)
			approver.Post("/api/workflow/{id}/reject", workflowHandler.RejectReport)
		})

		// Accounting only.
		priv.With(middleware.RequireRole("accounting")).Group(func(accounting chi.Router) {
			accounting.Get("/api/workflow/payable", workflowHandler.ListPayableReports)
			accounting.Post("/api/workflow/{id}/pay", workflowHandler.MarkReportAsPaid)
		})

		// Admin and Accounting.
		priv.With(middleware.RequireRole("admin", "accounting")).Group(func(adminAcct chi.Router) {
			adminAcct.Get("/api/reports/all", reportHandler.ListAllReports)
			adminAcct.Get("/api/tenant/members", tenantHandler.ListTenantMembers)
		})

		// Admin only.
		priv.With(middleware.RequireRole("admin")).Group(func(admin chi.Router) {
			admin.Get("/api/tenant", tenantHandler.GetTenant)
		})
	})

	return &TestServer{
		Router:  r,
		Pool:    pool,
		KeyPair: kp,
	}
}

// AuthRequest builds an authenticated HTTP request for the test server.
// body may be nil for requests without a body (GET, DELETE).
func (ts *TestServer) AuthRequest(t *testing.T, method, path string, body io.Reader, userID, tenantID, role string) *http.Request {
	t.Helper()

	token := GenerateTestToken(t, userID, tenantID, role)

	req, err := http.NewRequestWithContext(context.Background(), method, path, body)
	if err != nil {
		t.Fatalf("testutil: AuthRequest: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// Execute dispatches the request through the router and returns the recorded response.
func (ts *TestServer) Execute(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	ts.Router.ServeHTTP(rec, req)
	return rec
}

// NewAuthenticatedRequest is a standalone helper that builds an http.Request with
// a Bearer token generated from the shared test key pair.
// body may be nil.
func NewAuthenticatedRequest(t *testing.T, method, target string, body io.Reader, userID, tenantID, role string) *http.Request {
	t.Helper()

	token := GenerateTestToken(t, userID, tenantID, role)
	req, err := http.NewRequestWithContext(context.Background(), method, target, body)
	if err != nil {
		t.Fatalf("testutil: NewAuthenticatedRequest: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// SetRequestTimeout wraps the request context with a deadline useful for slow integration tests.
// Note: the cancel function is intentionally not exposed; the context will expire automatically.
func SetRequestTimeout(req *http.Request, d time.Duration) *http.Request {
	ctx, cancel := context.WithTimeout(req.Context(), d)
	_ = cancel
	return req.WithContext(ctx)
}
