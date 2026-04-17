package service_test

// サービス層ユニットテスト — AttachmentService（GetAttachmentDownload / GetAttachmentPreview）。
// モック実装を使って disposition の分岐と認可失敗時の PresignGetObject 未呼び出しを検証する。
//
// 対応テストケース: T2（implementation-plan.md §1.2）
//
// 実行コマンド:
//   go test ./internal/service/... -run TestAttachmentService -count=1
//
// Traceability: test_cases/attachments.md ATT-011（Download/Preview 共通認可テスト）

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/service"
)

// =============================================================================
// モック実装
// =============================================================================

// mockStorageClient は StorageClient のテスト用モック。
// PresignGetObject の呼び出し回数と受け取った disposition を記録する。
type mockStorageClient struct {
	presignCallCount int
	lastDisposition  string
	// presignErr を設定するとエラーを返す。
	presignErr error
}

func (m *mockStorageClient) Upload(_ context.Context, _ string, _ io.Reader, _ string) error {
	return nil
}

func (m *mockStorageClient) PresignGetObject(_ context.Context, _, _, _, disposition string, _ time.Duration) (string, time.Time, error) {
	m.presignCallCount++
	m.lastDisposition = disposition
	if m.presignErr != nil {
		return "", time.Time{}, m.presignErr
	}
	// テスト用のダミー URL を返す。
	return "http://example.com/presigned?disposition=" + disposition, time.Now().Add(15 * time.Minute), nil
}

func (m *mockStorageClient) Delete(_ context.Context, _ string) error {
	return nil
}

// mockReportRepository は ReportRepository の最小限モック。
type mockReportRepository struct {
	report *domain.ExpenseReport
	err    error
}

func (m *mockReportRepository) GetByID(_ context.Context, _, _ uuid.UUID) (*domain.ExpenseReport, error) {
	return m.report, m.err
}

func (m *mockReportRepository) Create(_ context.Context, _, _ uuid.UUID, _ string, _, _ time.Time, _ *uuid.UUID) (*domain.ExpenseReport, error) {
	return nil, errors.New("not implemented")
}
func (m *mockReportRepository) List(_ context.Context, _ uuid.UUID, _ domain.ReportListParams) ([]domain.ExpenseReport, int, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *mockReportRepository) Update(_ context.Context, _ *domain.ExpenseReport) error {
	return errors.New("not implemented")
}
func (m *mockReportRepository) UpdateStatus(_ context.Context, _ *domain.ExpenseReport) error {
	return errors.New("not implemented")
}
func (m *mockReportRepository) SoftDelete(_ context.Context, _, _ uuid.UUID) error {
	return errors.New("not implemented")
}
func (m *mockReportRepository) CountByStatus(_ context.Context, _ uuid.UUID, _ *uuid.UUID) (map[domain.ReportStatus]int, error) {
	return nil, errors.New("not implemented")
}
func (m *mockReportRepository) MonthlySummary(_ context.Context, _ uuid.UUID, _ *uuid.UUID, _ int) ([]domain.MonthlySummary, error) {
	return nil, errors.New("not implemented")
}
func (m *mockReportRepository) ListPending(_ context.Context, _ uuid.UUID, _ domain.WorkflowListParams) ([]domain.ExpenseReport, int, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *mockReportRepository) ListPayable(_ context.Context, _ uuid.UUID, _ domain.WorkflowListParams) ([]domain.ExpenseReport, int, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *mockReportRepository) ListRecentReports(_ context.Context, _, _ uuid.UUID, _ int) ([]domain.ExpenseReport, error) {
	return nil, errors.New("not implemented")
}

// mockItemRepository は ItemRepository の最小限モック。
type mockItemRepository struct{}

func (m *mockItemRepository) Create(_ context.Context, _, _ uuid.UUID, _ time.Time, _ int, _ uuid.UUID, _ string) (*domain.ExpenseItem, error) {
	return nil, errors.New("not implemented")
}
func (m *mockItemRepository) GetByID(_ context.Context, _, _, _ uuid.UUID) (*domain.ExpenseItem, error) {
	return &domain.ExpenseItem{}, nil
}
func (m *mockItemRepository) ListByReportID(_ context.Context, _, _ uuid.UUID) ([]domain.ExpenseItem, error) {
	return nil, errors.New("not implemented")
}
func (m *mockItemRepository) Update(_ context.Context, _ *domain.ExpenseItem) error {
	return errors.New("not implemented")
}
func (m *mockItemRepository) SoftDelete(_ context.Context, _, _, _ uuid.UUID) error {
	return errors.New("not implemented")
}

// mockAttachmentRepository は AttachmentRepository の最小限モック。
type mockAttachmentRepository struct {
	attachment *domain.Attachment
	err        error
}

func (m *mockAttachmentRepository) Create(_ context.Context, _, _, _, _ uuid.UUID, _ string, _ int, _ domain.MimeType, _ string) (*domain.Attachment, error) {
	return nil, errors.New("not implemented")
}
func (m *mockAttachmentRepository) GetByID(_ context.Context, _, _, _, _ uuid.UUID) (*domain.Attachment, error) {
	return m.attachment, m.err
}
func (m *mockAttachmentRepository) ListByItemID(_ context.Context, _, _, _ uuid.UUID) ([]domain.Attachment, error) {
	return nil, errors.New("not implemented")
}
func (m *mockAttachmentRepository) SoftDelete(_ context.Context, _, _, _, _ uuid.UUID) error {
	return errors.New("not implemented")
}

// mockAuthorizer は Authorizer の最小限モック。
type mockAuthorizer struct {
	canViewErr error
}

func (m *mockAuthorizer) CanModifyReport(_ domain.Actor, _ *domain.ExpenseReport) error {
	return errors.New("not implemented")
}
func (m *mockAuthorizer) CanViewReport(_ domain.Actor, _ *domain.ExpenseReport) error {
	return m.canViewErr
}
func (m *mockAuthorizer) CanApproveOrReject(_ domain.Actor, _ *domain.ExpenseReport) error {
	return errors.New("not implemented")
}
func (m *mockAuthorizer) CanMarkAsPaid(_ domain.Actor, _ *domain.ExpenseReport) error {
	return errors.New("not implemented")
}

// =============================================================================
// テストヘルパー
// =============================================================================

// testActor はテスト用の Actor（member ロール）を生成する。
func testActor() domain.Actor {
	return domain.Actor{
		UserID:   uuid.New(),
		TenantID: uuid.New(),
		Role:     domain.RoleMember,
	}
}

// testReport はテスト用の draft レポートを生成する（所有者は actor と一致させる）。
func testReport(ownerID, tenantID uuid.UUID) *domain.ExpenseReport {
	return &domain.ExpenseReport{
		ReportID: uuid.New(),
		UserID:   ownerID,
		TenantID: tenantID,
		Status:   domain.ReportStatusDraft,
	}
}

// testAttachment はテスト用の Attachment を生成する。
func testAttachment(fileName string) *domain.Attachment {
	return &domain.Attachment{
		AttachmentID: uuid.New(),
		FileName:     fileName,
		FileSize:     1024,
		MimeType:     domain.MimeTypeImageJpeg,
		S3Key:        "tenant/report/att",
	}
}

// =============================================================================
// テストケース
// =============================================================================

// TestAttachmentService_GetAttachmentDownload_PresignDisposition は
// GetAttachmentDownload が PresignGetObject に "attachment; filename=..." を渡すことを検証する。
func TestAttachmentService_GetAttachmentDownload_PresignDisposition(t *testing.T) {
	actor := testActor()
	report := testReport(actor.UserID, actor.TenantID)
	att := testAttachment("receipt.jpg")

	storage := &mockStorageClient{}
	svc := service.NewAttachmentService(
		&mockReportRepository{report: report},
		&mockItemRepository{},
		&mockAttachmentRepository{attachment: att},
		&mockAuthorizer{},
		storage,
	)

	_, err := svc.GetAttachmentDownload(context.Background(), actor, report.ReportID, uuid.New(), att.AttachmentID)
	if err != nil {
		t.Fatalf("GetAttachmentDownload: unexpected error: %v", err)
	}

	// PresignGetObject が 1 回呼ばれること。
	if storage.presignCallCount != 1 {
		t.Errorf("PresignGetObject 呼び出し回数 = %d, want 1", storage.presignCallCount)
	}

	// disposition が "attachment; filename=..." で始まること。
	if !strings.HasPrefix(storage.lastDisposition, `attachment; filename="`) {
		t.Errorf("disposition = %q, want prefix %q", storage.lastDisposition, `attachment; filename="`)
	}

	// ファイル名が disposition に含まれること。
	if !strings.Contains(storage.lastDisposition, "receipt.jpg") {
		t.Errorf("disposition = %q, ファイル名 receipt.jpg が含まれない", storage.lastDisposition)
	}
}

// TestAttachmentService_GetAttachmentPreview_PresignDisposition は
// GetAttachmentPreview が PresignGetObject に "inline; filename=..." を渡すことを検証する。
func TestAttachmentService_GetAttachmentPreview_PresignDisposition(t *testing.T) {
	actor := testActor()
	report := testReport(actor.UserID, actor.TenantID)
	att := testAttachment("photo.png")

	storage := &mockStorageClient{}
	svc := service.NewAttachmentService(
		&mockReportRepository{report: report},
		&mockItemRepository{},
		&mockAttachmentRepository{attachment: att},
		&mockAuthorizer{},
		storage,
	)

	_, err := svc.GetAttachmentPreview(context.Background(), actor, report.ReportID, uuid.New(), att.AttachmentID)
	if err != nil {
		t.Fatalf("GetAttachmentPreview: unexpected error: %v", err)
	}

	// PresignGetObject が 1 回呼ばれること。
	if storage.presignCallCount != 1 {
		t.Errorf("PresignGetObject 呼び出し回数 = %d, want 1", storage.presignCallCount)
	}

	// disposition が "inline; filename=..." で始まること。
	if !strings.HasPrefix(storage.lastDisposition, `inline; filename="`) {
		t.Errorf("disposition = %q, want prefix %q", storage.lastDisposition, `inline; filename="`)
	}

	// ファイル名が disposition に含まれること。
	if !strings.Contains(storage.lastDisposition, "photo.png") {
		t.Errorf("disposition = %q, ファイル名 photo.png が含まれない", storage.lastDisposition)
	}
}

// TestAttachmentService_GetAttachmentPreview_AuthzForbidden_NotCallPresign は
// 認可失敗時に PresignGetObject が呼ばれないことを検証する。
// ATT-011（getAttachmentDownload の preview 版）。
func TestAttachmentService_GetAttachmentPreview_AuthzForbidden_NotCallPresign(t *testing.T) {
	actor := testActor()
	report := testReport(uuid.New(), actor.TenantID) // 別のユーザーが所有

	storage := &mockStorageClient{}
	svc := service.NewAttachmentService(
		&mockReportRepository{report: report},
		&mockItemRepository{},
		&mockAttachmentRepository{attachment: testAttachment("secret.pdf")},
		&mockAuthorizer{canViewErr: domain.ErrForbidden},
		storage,
	)

	_, err := svc.GetAttachmentPreview(context.Background(), actor, report.ReportID, uuid.New(), uuid.New())

	// 403 FORBIDDEN が返ること。
	if !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("error = %v, want domain.ErrForbidden", err)
	}

	// 認可失敗時は PresignGetObject を呼ばないこと。
	if storage.presignCallCount != 0 {
		t.Errorf("PresignGetObject 呼び出し回数 = %d, want 0（認可失敗時は URL 発行しない）", storage.presignCallCount)
	}
}

// TestAttachmentService_GetAttachmentDownload_AuthzForbidden_NotCallPresign は
// GetAttachmentDownload も認可失敗時に PresignGetObject を呼ばないことを検証する。
func TestAttachmentService_GetAttachmentDownload_AuthzForbidden_NotCallPresign(t *testing.T) {
	actor := testActor()
	report := testReport(uuid.New(), actor.TenantID)

	storage := &mockStorageClient{}
	svc := service.NewAttachmentService(
		&mockReportRepository{report: report},
		&mockItemRepository{},
		&mockAttachmentRepository{attachment: testAttachment("secret.pdf")},
		&mockAuthorizer{canViewErr: domain.ErrForbidden},
		storage,
	)

	_, err := svc.GetAttachmentDownload(context.Background(), actor, report.ReportID, uuid.New(), uuid.New())

	if !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("error = %v, want domain.ErrForbidden", err)
	}
	if storage.presignCallCount != 0 {
		t.Errorf("PresignGetObject 呼び出し回数 = %d, want 0", storage.presignCallCount)
	}
}

// TestAttachmentService_GetAttachmentPreview_NotFound は
// 添付が存在しない場合に ErrResourceNotFound が返ることを検証する。
func TestAttachmentService_GetAttachmentPreview_NotFound(t *testing.T) {
	actor := testActor()
	report := testReport(actor.UserID, actor.TenantID)

	storage := &mockStorageClient{}
	svc := service.NewAttachmentService(
		&mockReportRepository{report: report},
		&mockItemRepository{},
		// 存在しない添付を返すリポジトリ。
		&mockAttachmentRepository{err: domain.ErrResourceNotFound},
		&mockAuthorizer{},
		storage,
	)

	_, err := svc.GetAttachmentPreview(context.Background(), actor, report.ReportID, uuid.New(), uuid.New())

	if !errors.Is(err, domain.ErrResourceNotFound) {
		t.Errorf("error = %v, want domain.ErrResourceNotFound", err)
	}
	// 添付が存在しない場合は PresignGetObject を呼ばないこと。
	if storage.presignCallCount != 0 {
		t.Errorf("PresignGetObject 呼び出し回数 = %d, want 0", storage.presignCallCount)
	}
}

// TestAttachmentService_GetAttachmentDownload_NotFound は
// GetAttachmentDownload でも添付不在の場合に ErrResourceNotFound が返ることを検証する。
func TestAttachmentService_GetAttachmentDownload_NotFound(t *testing.T) {
	actor := testActor()
	report := testReport(actor.UserID, actor.TenantID)

	storage := &mockStorageClient{}
	svc := service.NewAttachmentService(
		&mockReportRepository{report: report},
		&mockItemRepository{},
		&mockAttachmentRepository{err: domain.ErrResourceNotFound},
		&mockAuthorizer{},
		storage,
	)

	_, err := svc.GetAttachmentDownload(context.Background(), actor, report.ReportID, uuid.New(), uuid.New())

	if !errors.Is(err, domain.ErrResourceNotFound) {
		t.Errorf("error = %v, want domain.ErrResourceNotFound", err)
	}
	if storage.presignCallCount != 0 {
		t.Errorf("PresignGetObject 呼び出し回数 = %d, want 0", storage.presignCallCount)
	}
}
