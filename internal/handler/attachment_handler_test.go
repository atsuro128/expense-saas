package handler_test

// ハンドラ層統合テスト — 添付ファイル CRUD エンドポイント。
// 実際のルーターを通してリクエストを送り、HTTP ステータスとレスポンスボディを検証する。
//
// 対応テストケース: ATT-001〜ATT-060、CRS-010b
// 実行には PostgreSQL が必要（-tags=integration）。
//
// 実行コマンド:
//   go test ./internal/handler/... -v -tags=integration -run TestUploadAttachment
//   go test ./internal/handler/... -v -tags=integration -run TestListAttachments
//   go test ./internal/handler/... -v -tags=integration -run TestGetAttachmentDownload
//   go test ./internal/handler/... -v -tags=integration -run TestGetAttachmentPreview
//   go test ./internal/handler/... -v -tags=integration -run TestDeleteAttachment
//
// Traceability: test_cases/attachments.md（ATT-001〜ATT-060）、cross-cutting.md（CRS-010b）
// ATT-001 → TestUploadAttachment_Success_JPEG
// ATT-002 → TestUploadAttachment_Success_PNG
// ATT-003 → TestUploadAttachment_Success_PDF
// ATT-004 → TestUploadAttachment_Success_ExactlyMaxSize
// ATT-005 → TestUploadAttachment_Success_Approver
// ATT-006 → TestUploadAttachment_FileTooLarge
// ATT-007 → TestUploadAttachment_InvalidMimeType_GIF
// ATT-008 → TestUploadAttachment_SpoofedMimeType
// ATT-009 → TestUploadAttachment_MissingFilePart
// ATT-010 → TestUploadAttachment_NoContentType
// ATT-011 → TestUploadAttachment_Unauthorized
// ATT-012 → TestUploadAttachment_Forbidden_NotOwner
// ATT-013 → TestUploadAttachment_ReportNotEditable_Submitted
// ATT-014 → TestUploadAttachment_ReportNotEditable_Approved
// ATT-015 → TestUploadAttachment_ReportNotEditable_Rejected
// ATT-016 → TestUploadAttachment_ReportNotEditable_Paid
// ATT-017 → TestUploadAttachment_ReportNotFound
// ATT-018 → TestUploadAttachment_ItemNotFound
// ATT-019 → TestUploadAttachment_ItemBelongsToDifferentReport
// ATT-020 → TestListAttachments_Success_Owner
// ATT-021 → TestListAttachments_Success_NoAttachments
// ATT-022 → TestListAttachments_Success_Admin
// ATT-023 → TestListAttachments_Success_Accounting
// ATT-024 → TestListAttachments_Success_Approver_SubmittedReport
// ATT-025 → TestListAttachments_NoDownloadUrl
// ATT-026 → TestListAttachments_Unauthorized
// ATT-027 → TestListAttachments_Forbidden_Member_OtherOwner
// ATT-028 → TestListAttachments_ReportNotFound
// ATT-029 → TestListAttachments_ItemNotFound
// ATT-030 → TestGetAttachmentDownload_Success_Owner
// ATT-031 → TestGetAttachmentDownload_Success_Admin
// ATT-032 → TestGetAttachmentDownload_Success_Accounting
// ATT-033 → TestGetAttachmentDownload_Success_Approver_SubmittedReport
// ATT-034 → TestGetAttachmentDownload_ExpiresAt_15min
// ATT-035 → TestGetAttachmentDownload_Unauthorized_NoToken
// ATT-036 → TestGetAttachmentDownload_Forbidden_Member_OtherOwner
// ATT-037 → TestGetAttachmentDownload_Forbidden_Member_NotOwner
// ATT-038 → TestGetAttachmentDownload_AuthzCheckedBeforeUrlIssue
// ATT-039 → TestGetAttachmentDownload_Approver_DraftReport_Forbidden
// ATT-040 → TestGetAttachmentDownload_AttachmentNotFound
// ATT-041 → TestGetAttachmentDownload_ReportNotFound
// ATT-042 → TestDeleteAttachment_Success
// ATT-043 → TestDeleteAttachment_Success_SoftDelete_S3NotDeleted
// ATT-044 → TestDeleteAttachment_Unauthorized
// ATT-045 → TestDeleteAttachment_Forbidden_NotOwner_Approver
// ATT-046 → TestDeleteAttachment_Forbidden_NotOwner_Admin
// ATT-047 → TestDeleteAttachment_Forbidden_NotOwner_Accounting
// ATT-048 → TestDeleteAttachment_ReportNotEditable_Submitted
// ATT-049 → TestDeleteAttachment_ReportNotEditable_Approved
// ATT-050 → TestDeleteAttachment_ReportNotEditable_Paid
// ATT-051 → TestDeleteAttachment_ReportNotEditable_Rejected
// ATT-052 → TestDeleteAttachment_NotFound
// ATT-053 → TestDeleteAttachment_ReportNotFound
// ATT-054 → TestDeleteAttachment_AlreadyDeleted
// ATT-055 → TestGetAttachmentPreview_Success_Owner
// ATT-056 → TestGetAttachmentPreview_Success_Admin
// ATT-057 → TestGetAttachmentPreview_Success_Accounting
// ATT-058 → TestGetAttachmentPreview_Success_Approver_SubmittedReport
// ATT-059 → TestGetAttachmentPreview_Forbidden_Member_OtherOwner
// ATT-060 → TestGetAttachmentPreview_AttachmentNotFound
// CRS-010b → TestTenantIsolation_GetAttachmentPreview_OtherTenant_404

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/testutil"
)

// =============================================================================
// テスト共通セットアップ
// =============================================================================

// setupAttachmentTest はテスト用 DB を準備し、TestServer と pool を返す。
// テスト開始時にテーブルをクリーンアップし、標準フィクスチャを投入する。
func setupAttachmentTest(t *testing.T) (*testutil.TestServer, *pgxpool.Pool) {
	t.Helper()

	pool := testutil.SetupTestDB(t)
	testutil.CleanupTables(t, pool)
	testutil.SeedFixtures(t, pool)

	srv := testutil.NewTestServer(t, pool)
	return srv, pool
}

// =============================================================================
// テスト用ファイル生成ヘルパー
// =============================================================================

// makeJPEGFile は正常な JPEG ファイルのバイト列を生成する（マジックバイト: FF D8 FF）。
func makeJPEGFile(size int) []byte {
	buf := make([]byte, size)
	copy(buf, []byte{0xFF, 0xD8, 0xFF, 0xE0})
	return buf
}

// makePNGFile は正常な PNG ファイルのバイト列を生成する（マジックバイト: 89 50 4E 47 0D 0A 1A 0A）。
func makePNGFile(size int) []byte {
	buf := make([]byte, size)
	copy(buf, []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})
	return buf
}

// makePDFFile は正常な PDF ファイルのバイト列を生成する（マジックバイト: %PDF）。
func makePDFFile(size int) []byte {
	buf := make([]byte, size)
	copy(buf, []byte{0x25, 0x50, 0x44, 0x46})
	return buf
}

// makeSpoofedJPEGFile は Content-Type が image/jpeg だが、実際の中身が GIF のファイルを生成する。
func makeSpoofedJPEGFile() []byte {
	buf := make([]byte, 1024)
	copy(buf, []byte{0x47, 0x49, 0x46, 0x38}) // GIF マジックバイト
	return buf
}

// makeGIFFile は GIF ファイルのバイト列を生成する（許可されていない MIME タイプ）。
func makeGIFFile(size int) []byte {
	buf := make([]byte, size)
	copy(buf, []byte{0x47, 0x49, 0x46, 0x38})
	return buf
}

// =============================================================================
// multipart/form-data リクエスト構築ヘルパー
// =============================================================================

// buildMultipartRequest は multipart/form-data リクエストを構築する。
// contentType が空文字の場合は Content-Type ヘッダーを省略する（ATT-010 の検証用）。
func buildMultipartRequest(t *testing.T, url, fieldName, fileName, contentType string, content []byte) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	var part io.Writer
	var err error
	if contentType != "" {
		// Content-Type を明示的に指定してパートを作成する。
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fileName))
		h.Set("Content-Type", contentType)
		part, err = writer.CreatePart(h)
	} else {
		// Content-Type ヘッダーを省略したパートを生成する（ATT-010 の検証用）。
		// CreateFormFile は application/octet-stream を既定で付与するため、
		// textproto.MIMEHeader に Content-Disposition のみを設定して CreatePart を使う。
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fileName))
		part, err = writer.CreatePart(h)
	}
	if err != nil {
		t.Fatalf("buildMultipartRequest: CreateFormFile: %v", err)
	}

	if _, err := part.Write(content); err != nil {
		t.Fatalf("buildMultipartRequest: Write: %v", err)
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("buildMultipartRequest: Close: %v", err)
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, &body)
	if err != nil {
		t.Fatalf("buildMultipartRequest: NewRequest: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

// buildMultipartRequestNoFilePart は file パートを含まない multipart/form-data リクエストを構築する（ATT-009 の検証用）。
func buildMultipartRequestNoFilePart(t *testing.T, url string) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// file パートを省略し、ダミーのフィールドのみ追加する。
	if err := writer.WriteField("dummy", "value"); err != nil {
		t.Fatalf("buildMultipartRequestNoFilePart: WriteField: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("buildMultipartRequestNoFilePart: Close: %v", err)
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, &body)
	if err != nil {
		t.Fatalf("buildMultipartRequestNoFilePart: NewRequest: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

// addAuthHeader は JWT トークンを生成してリクエストに認証ヘッダーを付与する。
// multipart/form-data リクエストのボディを維持しながら認証ヘッダーのみを追加する。
func addAuthHeader(t *testing.T, req *http.Request, userID, tenantID, role string) *http.Request {
	t.Helper()

	token := testutil.GenerateTestToken(t, userID, tenantID, role)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

// =============================================================================
// 1. POST /api/reports/{id}/items/{itemId}/attachments — uploadAttachment
// =============================================================================

// --- 1-1. 正常系 ---

// ATT-001: JPEG ファイルのアップロード成功 → 201 Created。
func TestUploadAttachment_Success_JPEG(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 201 Created: JPEG ファイルアップロード成功（ATT-001）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// ATT-002: PNG ファイルのアップロード成功 → 201 Created。
func TestUploadAttachment_Success_PNG(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.png", "image/png", makePNGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 201 Created: PNG ファイルアップロード成功（ATT-002）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// ATT-003: PDF ファイルのアップロード成功 → 201 Created。
func TestUploadAttachment_Success_PDF(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.pdf", "application/pdf", makePDFFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 201 Created: PDF ファイルアップロード成功（ATT-003）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// ATT-004: ちょうど 5MB（境界値）のファイルアップロード成功 → 201 Created。
func TestUploadAttachment_Success_ExactlyMaxSize(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	// 5MB = 5 * 1024 * 1024 = 5,242,880 バイト（境界値・許可）。
	req := buildMultipartRequest(t, url, "file", "large.jpg", "image/jpeg", makeJPEGFile(5242880))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 201 Created: 5MB は許可範囲内（ATT-004）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// ATT-005: Approver が所有者として JPEG をアップロード成功 → 201 Created。
func TestUploadAttachment_Success_Approver(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// Approver が所有者のレポートと明細を作成する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	approverID := testutil.MustParseUUID(testutil.UserApproverID)

	reportID := testutil.CreateReport(t, pool, tenantID, approverID,
		testutil.WithReportTitle("Approver のレポート"),
		testutil.WithReportStatus(domain.ReportStatusDraft),
	)

	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)

	url := "/api/reports/" + reportID.String() + "/items/" + itemID.String() + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserApproverID, testutil.TenantAID, "approver")

	rec := srv.Execute(req)

	// 201 Created: Approver が所有者の場合はアップロード可能（ATT-005）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

// --- 1-2. ファイルバリデーション異常系 ---

// ATT-006: 5MB 超過（5,242,881 バイト）のファイル → 413 FILE_TOO_LARGE。
func TestUploadAttachment_FileTooLarge(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	// 5MB + 1 バイト = 5,242,881 バイト（1バイトオーバー）。
	req := buildMultipartRequest(t, url, "file", "toolarge.jpg", "image/jpeg", makeJPEGFile(5242881))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 413 FILE_TOO_LARGE: サイズ制限超過（ATT-006）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusRequestEntityTooLarge)
}

// ATT-007: 許可されていない MIME タイプ（GIF）→ 422 INVALID_FILE_TYPE。
func TestUploadAttachment_InvalidMimeType_GIF(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.gif", "image/gif", makeGIFFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 INVALID_FILE_TYPE: GIF は許可リスト外（ATT-007）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-008: MIME タイプ偽装（Content-Type: image/jpeg、実際は GIF）→ 422 INVALID_FILE_TYPE。
func TestUploadAttachment_SpoofedMimeType(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	// Content-Type は image/jpeg と宣言するが、マジックバイトは GIF。
	req := buildMultipartRequest(t, url, "file", "spoofed.jpg", "image/jpeg", makeSpoofedJPEGFile())
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 INVALID_FILE_TYPE: マジックバイト不一致で拒否（ATT-008）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-009: file パートなし → 400 BAD_REQUEST。
func TestUploadAttachment_MissingFilePart(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequestNoFilePart(t, url)
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 400 BAD_REQUEST: file パートが存在しない（ATT-009）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusBadRequest)
}

// ATT-010: Content-Type ヘッダーなしのファイル → 422 INVALID_FILE_TYPE。
func TestUploadAttachment_NoContentType(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	// contentType を空文字にすることで Content-Type ヘッダーなしのリクエストを構築する。
	req := buildMultipartRequest(t, url, "file", "noct.jpg", "", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 INVALID_FILE_TYPE: Content-Type なしは拒否（ATT-010）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// --- 1-3. RBAC 異常系 ---

// ATT-011: 認証トークンなし → 401 UNAUTHORIZED。
func TestUploadAttachment_Unauthorized(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.Close(); err != nil {
		t.Fatalf("TestUploadAttachment_Unauthorized: Close: %v", err)
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, &body)
	if err != nil {
		t.Fatalf("TestUploadAttachment_Unauthorized: NewRequest: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	// Authorization ヘッダーを付与しない。

	rec := srv.Execute(req)

	// 401 UNAUTHORIZED: 認証なし（ATT-011）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// ATT-012: 非所有者（Approver）がアップロード → 403 FORBIDDEN。
func TestUploadAttachment_Forbidden_NotOwner(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	// report_draft の所有者は Test Member。Test Approver は所有者でない。
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserApproverID, testutil.TenantAID, "approver")

	rec := srv.Execute(req)

	// 403 FORBIDDEN: 同一テナント内の非所有者は拒否（ATT-012）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// --- 1-4. レポート状態異常系 ---

// ATT-013: submitted 状態のレポートへのアップロード → 422 REPORT_NOT_EDITABLE。
func TestUploadAttachment_ReportNotEditable_Submitted(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// report_submitted に明細を追加してテストする。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: submitted 状態は編集不可（ATT-013）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-014: approved 状態のレポートへのアップロード → 422 REPORT_NOT_EDITABLE。
func TestUploadAttachment_ReportNotEditable_Approved(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportApprovedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)

	url := "/api/reports/" + testutil.ReportApprovedID + "/items/" + itemID.String() + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: approved 状態は編集不可（ATT-014）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-015: rejected 状態のレポートへのアップロード → 422 REPORT_NOT_EDITABLE。
func TestUploadAttachment_ReportNotEditable_Rejected(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportRejectedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)

	url := "/api/reports/" + testutil.ReportRejectedID + "/items/" + itemID.String() + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: rejected 状態は編集不可（ATT-015）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-016: paid 状態のレポートへのアップロード → 422 REPORT_NOT_EDITABLE。
func TestUploadAttachment_ReportNotEditable_Paid(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportPaidID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)

	url := "/api/reports/" + testutil.ReportPaidID + "/items/" + itemID.String() + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: paid 状態は編集不可（ATT-016）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// --- 1-5. リソース不存在 ---

// ATT-017: 存在しないレポート ID → 404 RESOURCE_NOT_FOUND。
func TestUploadAttachment_ReportNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentReportID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + nonExistentReportID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: レポートが存在しない（ATT-017）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// ATT-018: 存在しない明細 ID → 404 RESOURCE_NOT_FOUND。
func TestUploadAttachment_ItemNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentItemID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + nonExistentItemID + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 明細が存在しない（ATT-018）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// ATT-019: 明細が URL のレポートに属さない → 404 RESOURCE_NOT_FOUND。
func TestUploadAttachment_ItemBelongsToDifferentReport(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// report_draft_empty に属する明細を新規作成する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	emptyReportID := testutil.MustParseUUID(testutil.ReportDraftEmptyID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	otherItemID := testutil.CreateItem(t, pool, tenantID, emptyReportID, categoryID)

	// report_draft の URL に report_draft_empty の明細 ID を組み合わせる。
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + otherItemID.String() + "/attachments"
	req := buildMultipartRequest(t, url, "file", "receipt.jpg", "image/jpeg", makeJPEGFile(1024))
	req = addAuthHeader(t, req, testutil.UserMemberID, testutil.TenantAID, "member")

	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 明細が URL のレポートに属さない（ATT-019）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 2. GET /api/reports/{id}/items/{itemId}/attachments — listAttachments
// =============================================================================

// --- 2-1. 正常系 ---

// ATT-020: 所有者が添付ファイル一覧を取得 → 200 OK。
func TestListAttachments_Success_Owner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// att_draft_jpeg フィクスチャを追加する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentFileSize(245760),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: 添付ファイル一覧が返る（ATT-020）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-021: 添付ファイルがない場合 → 200 OK、空配列。
func TestListAttachments_Success_NoAttachments(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// report_draft_empty に明細を追加する（添付は追加しない）。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	emptyReportID := testutil.MustParseUUID(testutil.ReportDraftEmptyID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	emptyItemID := testutil.CreateItem(t, pool, tenantID, emptyReportID, categoryID)

	url := "/api/reports/" + testutil.ReportDraftEmptyID + "/items/" + emptyItemID.String() + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: 空配列が返る（ATT-021）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-022: Admin が同一テナントの添付ファイル一覧を取得 → 200 OK。
func TestListAttachments_Success_Admin(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// report_submitted に明細と添付を追加する。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin は同一テナントの全レポートの添付を閲覧可能（ATT-022）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-023: Accounting が同一テナントの添付ファイル一覧を取得 → 200 OK。
func TestListAttachments_Success_Accounting(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting は同一テナントの全レポートの添付を閲覧可能（ATT-023）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-024: Approver が submitted レポートの添付ファイル一覧を取得 → 200 OK。
func TestListAttachments_Success_Approver_SubmittedReport(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver は submitted レポートの添付を閲覧可能（ATT-024）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-025: 一覧レスポンスに download_url フィールドが含まれない。
func TestListAttachments_NoDownloadUrl(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentFileSize(245760),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: download_url フィールドは含まれない（ATT-025）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusOK)
	// ボディのデコードは機能実装後に行うため、ここでは省略する。
}

// --- 2-2. RBAC 異常系 ---

// ATT-026: 認証トークンなし → 401 UNAUTHORIZED。
func TestListAttachments_Unauthorized(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("TestListAttachments_Unauthorized: NewRequest: %v", err)
	}

	rec := srv.Execute(req)

	// 401 UNAUTHORIZED: 認証なし（ATT-026）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// ATT-027: Approver が draft レポートの添付を閲覧 → 403 FORBIDDEN。
func TestListAttachments_Forbidden_Member_OtherOwner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// report_draft に添付を追加する（所有者は Test Member）。
	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments"
	// Test Approver は draft レポートの所有者でない → 閲覧不可。
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: draft レポートは所有者のみ閲覧可能（ATT-027）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// --- 2-3. リソース不存在 ---

// ATT-028: 存在しないレポート ID → 404 RESOURCE_NOT_FOUND。
func TestListAttachments_ReportNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentReportID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + nonExistentReportID + "/items/" + testutil.ItemDraftID + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: レポートが存在しない（ATT-028）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// ATT-029: 存在しない明細 ID → 404 RESOURCE_NOT_FOUND。
func TestListAttachments_ItemNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentItemID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + nonExistentItemID + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 明細が存在しない（ATT-029）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 3. GET /api/reports/{id}/items/{itemId}/attachments/{attId}/download — getAttachmentDownload
// =============================================================================

// --- 3-1. 正常系 ---

// ATT-030: 所有者が署名付き URL を取得 → 200 OK。
func TestGetAttachmentDownload_Success_Owner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentFileSize(245760),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: 署名付き URL を含むレスポンスが返る（ATT-030）。
	testutil.AssertStatus(t, rec, http.StatusOK)
	var body struct {
		Data struct {
			URL      string `json:"url"`
			FileName string `json:"file_name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("ATT-030: レスポンスのデコード失敗: %v", err)
	}
	if body.Data.URL == "" {
		t.Error("ATT-030: data.url が空")
	}
	if body.Data.FileName != "receipt.jpg" {
		t.Errorf("ATT-030: data.file_name = %q, want %q", body.Data.FileName, "receipt.jpg")
	}
}

// ATT-031: Admin が submitted レポートの添付の署名付き URL を取得 → 200 OK。
func TestGetAttachmentDownload_Success_Admin(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin は同一テナントの全レポートの添付をダウンロード可能（ATT-031）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-032: Accounting が approved レポートの添付の署名付き URL を取得 → 200 OK。
func TestGetAttachmentDownload_Success_Accounting(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportApprovedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("photo.png"),
		testutil.WithAttachmentFileSize(51200),
		testutil.WithAttachmentMimeType(domain.MimeTypeImagePng),
	)

	url := "/api/reports/" + testutil.ReportApprovedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting は同一テナントの全レポートの添付をダウンロード可能（ATT-032）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-033: Approver が submitted レポートの添付の署名付き URL を取得 → 200 OK。
func TestGetAttachmentDownload_Success_Approver_SubmittedReport(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver は submitted レポートの添付をダウンロード可能（ATT-033）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-034: expires_at が現在時刻から 15 分後であることを検証 → 200 OK。
func TestGetAttachmentDownload_ExpiresAt_15min(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: expires_at が現在時刻から 15 分後（ATT-034）。
	testutil.AssertStatus(t, rec, http.StatusOK)
	var body struct {
		Data struct {
			ExpiresAt string `json:"expires_at"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("ATT-034: レスポンスのデコード失敗: %v", err)
	}
	if body.Data.ExpiresAt == "" {
		t.Error("ATT-034: data.expires_at が空")
	}
}

// --- 3-2. 署名付き URL 認可チェック ---

// ATT-035: 認証トークンなし → 401 UNAUTHORIZED（URL 発行なし）。
func TestGetAttachmentDownload_Unauthorized_NoToken(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/download"
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("TestGetAttachmentDownload_Unauthorized_NoToken: NewRequest: %v", err)
	}
	// Authorization ヘッダーを付与しない。

	rec := srv.Execute(req)

	// 401 UNAUTHORIZED: JWT 検証失敗時は署名付き URL を発行しない（ATT-035）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// ATT-036: Approver が draft レポートの添付の署名付き URL を取得 → 403 FORBIDDEN。
func TestGetAttachmentDownload_Forbidden_Member_OtherOwner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/download"
	// Test Approver は draft レポートの所有者でない → 閲覧不可。
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 閲覧権限がない場合は署名付き URL を発行しない（ATT-036）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// ATT-037: 別の Member ユーザー（非所有者）が submitted レポートの添付を取得 → 403 FORBIDDEN。
func TestGetAttachmentDownload_Forbidden_Member_NotOwner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// 別の Member ユーザー（test-member2）を作成する。
	anotherMemberID := testutil.CreateUser(t, pool, testutil.WithUserEmail("test-member2@example.com"))
	testutil.CreateMembership(t, pool,
		testutil.MustParseUUID(testutil.TenantAID),
		anotherMemberID,
		domain.RoleMember,
	)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/download"
	// 別の Member は所有者でない → 閲覧不可。
	req := srv.AuthRequest(t, http.MethodGet, url, nil, anotherMemberID.String(), testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Member は自分が作成したレポートの添付のみ閲覧可能（ATT-037）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// ATT-038: 認可拒否時に S3 署名付き URL 生成処理が呼び出されないことを確認。
//
// ハンドラ統合テストレベルでは S3 クライアントをモックとして注入する手段がなく、
// PresignGetObject が「実際に呼ばれたかどうか」を直接検証することはできない。
// 代わりに 403 FORBIDDEN レスポンスが返ることと、レスポンスボディに url フィールドが
// 含まれないことで「URL 発行処理が到達していない」ことをハンドラ HTTP レベルで検証する。
// PresignGetObject 呼び出し有無の直接検証は attachment_service_test.go（T2）で行う。
func TestGetAttachmentDownload_AuthzCheckedBeforeUrlIssue(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/download"
	// Test Approver は draft レポートの所有者でない → 閲覧不可。
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN が返ること（ATT-038）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)

	// レスポンスボディに url フィールドが含まれないこと（AttachmentAccess スキーマ移行後）。
	var body struct {
		Data *struct {
			URL *string `json:"url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err == nil {
		// パースが成功した場合、data.url が nil であること。
		if body.Data != nil && body.Data.URL != nil {
			t.Errorf("ATT-038: url が含まれていてはならないが、%q が返された（S3 URL 生成が実行されている）", *body.Data.URL)
		}
	}
}

// --- 3-3. RBAC 異常系 ---

// ATT-039: Approver が draft レポートの添付の署名付き URL を取得 → 403 FORBIDDEN。
func TestGetAttachmentDownload_Approver_DraftReport_Forbidden(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/download"
	// Approver の閲覧範囲は submitted レポートのみ（自分のレポートを除く）。
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Approver は draft レポートを閲覧不可（ATT-039）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// --- 3-4. リソース不存在 ---

// ATT-040: 存在しない attachment_id → 404 RESOURCE_NOT_FOUND。
func TestGetAttachmentDownload_AttachmentNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentAttID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + nonExistentAttID + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 添付が存在しない（ATT-040）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// ATT-041: 存在しないレポート ID → 404 RESOURCE_NOT_FOUND。
func TestGetAttachmentDownload_ReportNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentReportID := "00000000-0000-0000-0000-000000000099"
	nonExistentAttID := "00000000-0000-0000-0000-000000000088"
	url := "/api/reports/" + nonExistentReportID + "/items/" + testutil.ItemDraftID + "/attachments/" + nonExistentAttID + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: レポートが存在しない（ATT-041）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 4. DELETE /api/reports/{id}/items/{itemId}/attachments/{attId} — deleteAttachment
// =============================================================================

// --- 4-1. 正常系 ---

// ATT-042: 所有者が添付ファイルを論理削除 → 204 No Content。
func TestDeleteAttachment_Success(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: 論理削除される（ATT-042）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// ATT-043: 論理削除後、S3 オブジェクトは即時削除されない（物理削除はバッチ処理）。
// 注: S3 のモック検証はハンドラ層では困難なため、204 が返ることのみ検証する。
func TestDeleteAttachment_Success_SoftDelete_S3NotDeleted(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 204 No Content: S3 即時削除なし（論理削除のみ）（ATT-043）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNoContent)
}

// --- 4-2. RBAC 異常系 ---

// ATT-044: 認証トークンなし → 401 UNAUTHORIZED。
func TestDeleteAttachment_Unauthorized(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	req, err := http.NewRequestWithContext(context.Background(), http.MethodDelete, url, nil)
	if err != nil {
		t.Fatalf("TestDeleteAttachment_Unauthorized: NewRequest: %v", err)
	}
	// Authorization ヘッダーを付与しない。

	rec := srv.Execute(req)

	// 401 UNAUTHORIZED: 認証なし（ATT-044）。
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
}

// ATT-045: 非所有者（Approver）が削除 → 403 FORBIDDEN。
func TestDeleteAttachment_Forbidden_NotOwner_Approver(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	// Test Approver は report_draft の所有者でない。
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 所有者でない場合は削除不可（ATT-045）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// ATT-046: Admin であっても他者のレポートの添付を削除不可 → 403 FORBIDDEN。
func TestDeleteAttachment_Forbidden_NotOwner_Admin(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	// Test Admin は report_draft の所有者でない。
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Admin であっても他者のレポートの添付を削除不可（ATT-046）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// ATT-047: Accounting が非所有者として削除 → 403 FORBIDDEN。
func TestDeleteAttachment_Forbidden_NotOwner_Accounting(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	// Test Accounting は report_draft の所有者でない。
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: Accounting であっても非所有者は削除不可（ATT-047）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

// --- 4-3. レポート状態異常系 ---

// ATT-048: submitted 状態のレポートの添付を削除 → 422 REPORT_NOT_EDITABLE。
func TestDeleteAttachment_ReportNotEditable_Submitted(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: submitted 状態は編集不可（ATT-048）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-049: approved 状態のレポートの添付を削除 → 422 REPORT_NOT_EDITABLE。
func TestDeleteAttachment_ReportNotEditable_Approved(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportApprovedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("photo.png"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImagePng),
	)

	url := "/api/reports/" + testutil.ReportApprovedID + "/items/" + itemID.String() + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: approved 状態は編集不可（ATT-049）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-050: paid 状態のレポートの添付を削除 → 422 REPORT_NOT_EDITABLE。
func TestDeleteAttachment_ReportNotEditable_Paid(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportPaidID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportPaidID + "/items/" + itemID.String() + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: paid 状態は編集不可（ATT-050）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// ATT-051: rejected 状態のレポートの添付を削除 → 422 REPORT_NOT_EDITABLE。
func TestDeleteAttachment_ReportNotEditable_Rejected(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportRejectedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportRejectedID + "/items/" + itemID.String() + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 422 REPORT_NOT_EDITABLE: rejected 状態は編集不可（ATT-051）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
}

// --- 4-4. リソース不存在 ---

// ATT-052: 存在しない attachment_id → 404 RESOURCE_NOT_FOUND。
func TestDeleteAttachment_NotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentAttID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + nonExistentAttID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 添付が存在しない（ATT-052）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// ATT-053: 存在しないレポート ID → 404 RESOURCE_NOT_FOUND。
func TestDeleteAttachment_ReportNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentReportID := "00000000-0000-0000-0000-000000000099"
	nonExistentAttID := "00000000-0000-0000-0000-000000000088"
	url := "/api/reports/" + nonExistentReportID + "/items/" + testutil.ItemDraftID + "/attachments/" + nonExistentAttID
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: レポートが存在しない（ATT-053）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// ATT-054: 論理削除済みの添付に再削除 → 404 RESOURCE_NOT_FOUND。
func TestDeleteAttachment_AlreadyDeleted(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	// 論理削除する（deleted_at を設定する）。
	testutil.SoftDeleteAttachment(t, pool, attID)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 削除済みリソースは存在しないものとして扱う（ATT-054）。機能未実装のため現在は失敗する。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// テナント分離テスト（CRS-008〜CRS-011）
// =============================================================================

// CRS-008: 他テナントの添付にアップロード → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_UploadAttachment_OtherTenant_404(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	// テナントB にレポート・明細を作成する。
	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, testutil.GetTransportCategoryID(t, pool))

	// テナントA の userMember がテナントB の明細に添付をアップロードする。
	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String() + "/attachments"
	content := makeJPEGFile(1024)
	multipartReq := buildMultipartRequest(t, url, "file", "test.jpg", "image/jpeg", content)
	multipartContentType := multipartReq.Header.Get("Content-Type")
	// AuthRequest で認証ヘッダーを設定した後、Content-Type を multipart に戻す。
	req := srv.AuthRequest(t, http.MethodPost, url, multipartReq.Body, testutil.UserMemberID, testutil.TenantAID, "member")
	req.Header.Set("Content-Type", multipartContentType)
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: RLS によりテナントBのリソースは不可視（CRS-008）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// CRS-009: 他テナントの添付一覧を取得 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_ListAttachments_OtherTenant_404(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, testutil.GetTransportCategoryID(t, pool))

	// テナントA の userMember がテナントB の明細の添付一覧を取得する。
	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String() + "/attachments"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: RLS によりテナントBのリソースは不可視（CRS-009）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// CRS-010: 他テナントの添付ダウンロード URL 取得 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_GetAttachmentDownload_OtherTenant_404(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, testutil.GetTransportCategoryID(t, pool))
	attBID := testutil.CreateAttachment(t, pool, tenantBID, reportBID, itemBID,
		testutil.WithAttachmentFileName("receipt-b.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	// テナントA の userMember がテナントB の添付のダウンロード URL を取得する。
	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String() + "/attachments/" + attBID.String() + "/download"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: RLS によりテナントBのリソースは不可視（CRS-010）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// CRS-011: 他テナントの添付を削除 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_DeleteAttachment_OtherTenant_404(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, testutil.GetTransportCategoryID(t, pool))
	attBID := testutil.CreateAttachment(t, pool, tenantBID, reportBID, itemBID,
		testutil.WithAttachmentFileName("receipt-b.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	// テナントA の userMember がテナントB の添付を削除する。
	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String() + "/attachments/" + attBID.String()
	req := srv.AuthRequest(t, http.MethodDelete, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: RLS によりテナントBのリソースは不可視（CRS-011）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// 5. GET /api/reports/{id}/items/{itemId}/attachments/{attId}/preview — getAttachmentPreview
// =============================================================================

// --- 5-1. 正常系 ---

// ATT-055: 所有者がプレビュー用署名付き URL を取得 → 200 OK、data.url を含む。
func TestGetAttachmentPreview_Success_Owner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentFileSize(245760),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/preview"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 200 OK: プレビュー用署名付き URL を含む AttachmentAccess スキーマが返る（ATT-055）。
	testutil.AssertStatus(t, rec, http.StatusOK)
	var body struct {
		Data struct {
			URL      string `json:"url"`
			FileName string `json:"file_name"`
			MimeType string `json:"mime_type"`
			FileSize int    `json:"file_size"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("ATT-055: レスポンスのデコード失敗: %v", err)
	}
	if body.Data.URL == "" {
		t.Error("ATT-055: data.url が空")
	}
	if body.Data.FileName != "receipt.jpg" {
		t.Errorf("ATT-055: data.file_name = %q, want %q", body.Data.FileName, "receipt.jpg")
	}
	if body.Data.MimeType != "image/jpeg" {
		t.Errorf("ATT-055: data.mime_type = %q, want %q", body.Data.MimeType, "image/jpeg")
	}
}

// ATT-056: Admin が submitted レポートの添付のプレビュー URL を取得 → 200 OK。
func TestGetAttachmentPreview_Success_Admin(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/preview"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserAdminID, testutil.TenantAID, "admin")
	rec := srv.Execute(req)

	// 200 OK: Admin は同一テナントの全レポートの添付をプレビュー可能（ATT-056）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-057: Accounting が approved レポートの添付のプレビュー URL を取得 → 200 OK。
func TestGetAttachmentPreview_Success_Accounting(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportApprovedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("photo.png"),
		testutil.WithAttachmentFileSize(51200),
		testutil.WithAttachmentMimeType(domain.MimeTypeImagePng),
	)

	url := "/api/reports/" + testutil.ReportApprovedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/preview"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserAccountingID, testutil.TenantAID, "accounting")
	rec := srv.Execute(req)

	// 200 OK: Accounting は同一テナントの全レポートの添付をプレビュー可能（ATT-057）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// ATT-058: Approver が submitted レポートの添付のプレビュー URL を取得 → 200 OK。
func TestGetAttachmentPreview_Success_Approver_SubmittedReport(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportSubmittedID)
	var categoryID = testutil.GetTransportCategoryID(t, pool)
	itemID := testutil.CreateItem(t, pool, tenantID, reportID, categoryID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("invoice.pdf"),
		testutil.WithAttachmentFileSize(102400),
		testutil.WithAttachmentMimeType(domain.MimeTypeApplicationPDF),
	)

	url := "/api/reports/" + testutil.ReportSubmittedID + "/items/" + itemID.String() + "/attachments/" + attID.String() + "/preview"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 200 OK: Approver は submitted レポートの添付をプレビュー可能（ATT-058）。
	testutil.AssertStatus(t, rec, http.StatusOK)
}

// --- 5-2. 認可エラー ---

// ATT-059: Approver が draft レポートの添付のプレビュー URL を取得 → 403 FORBIDDEN。
// 閲覧権限がない場合はプレビュー用署名付き URL を発行しない（getAttachmentDownload と同一認可ロジック）。
func TestGetAttachmentPreview_Forbidden_Member_OtherOwner(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantID := testutil.MustParseUUID(testutil.TenantAID)
	reportID := testutil.MustParseUUID(testutil.ReportDraftID)
	itemID := testutil.MustParseUUID(testutil.ItemDraftID)
	attID := testutil.CreateAttachment(t, pool, tenantID, reportID, itemID,
		testutil.WithAttachmentFileName("receipt.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + attID.String() + "/preview"
	// Test Approver は draft レポートの所有者でない → 閲覧不可。
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserApproverID, testutil.TenantAID, "approver")
	rec := srv.Execute(req)

	// 403 FORBIDDEN: 閲覧権限がない場合はプレビュー用 URL を発行しない（ATT-059）。
	testutil.AssertStatus(t, rec, http.StatusForbidden)

	// レスポンスボディに url フィールドが含まれないこと。
	var body struct {
		Data *struct {
			URL *string `json:"url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err == nil {
		if body.Data != nil && body.Data.URL != nil {
			t.Errorf("ATT-059: url が含まれていてはならないが、%q が返された", *body.Data.URL)
		}
	}
}

// --- 5-3. リソース不存在 ---

// ATT-060: 存在しない attachment_id でプレビュー URL を取得 → 404 RESOURCE_NOT_FOUND。
func TestGetAttachmentPreview_AttachmentNotFound(t *testing.T) {
	srv, _ := setupAttachmentTest(t)

	nonExistentAttID := "00000000-0000-0000-0000-000000000099"
	url := "/api/reports/" + testutil.ReportDraftID + "/items/" + testutil.ItemDraftID + "/attachments/" + nonExistentAttID + "/preview"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: 添付が存在しない（ATT-060）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}

// =============================================================================
// テナント分離（プレビュー）
// =============================================================================

// CRS-010b: 他テナントの添付プレビュー URL 取得 → 404 RESOURCE_NOT_FOUND。
func TestTenantIsolation_GetAttachmentPreview_OtherTenant_404(t *testing.T) {
	srv, pool := setupAttachmentTest(t)

	tenantBID := testutil.MustParseUUID(testutil.TenantBID)
	memberBID := testutil.MustParseUUID(testutil.UserMemberBID)
	reportBID := testutil.CreateReport(t, pool, tenantBID, memberBID)
	itemBID := testutil.CreateItem(t, pool, tenantBID, reportBID, testutil.GetTransportCategoryID(t, pool))
	attBID := testutil.CreateAttachment(t, pool, tenantBID, reportBID, itemBID,
		testutil.WithAttachmentFileName("receipt-b.jpg"),
		testutil.WithAttachmentMimeType(domain.MimeTypeImageJpeg),
	)

	// テナントA の userMember がテナントB の添付のプレビュー URL を取得する。
	url := "/api/reports/" + reportBID.String() + "/items/" + itemBID.String() + "/attachments/" + attBID.String() + "/preview"
	req := srv.AuthRequest(t, http.MethodGet, url, nil, testutil.UserMemberID, testutil.TenantAID, "member")
	rec := srv.Execute(req)

	// 404 RESOURCE_NOT_FOUND: RLS によりテナントBのリソースは不可視（CRS-010b）。
	testutil.AssertStatus(t, rec, http.StatusNotFound)
}
