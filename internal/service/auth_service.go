package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
)

type authService struct {
	ownerPool        *pgxpool.Pool
	userRepo         domain.UserRepository
	tenantRepo       domain.TenantRepository
	membershipRepo   domain.MembershipRepository
	refreshTokenRepo domain.RefreshTokenRepository
	passwordRepo     domain.PasswordResetTokenRepository
	hasher           domain.PasswordHasher
	tokenGen         domain.TokenGenerator
	tokenVerifier    domain.TokenVerifier
}

// dummyHash はタイミングサイドチャネル攻撃防止用のダミーハッシュ。
// ユーザー不存在時もパスワード検証と同等の計算コストを発生させる（SEC-011）。
var dummyHash = func() string {
	h := domain.NewArgon2idHasher()
	hash, _ := h.HashPassword("dummy-password-for-timing")
	return hash
}()

// NewAuthService は AuthService を生成して返す。
// ownerPool は expense_owner ロール用の DB pool で、RLS が設定されていないため
// テナント未確定の認証操作（signup / login / refresh / logout / password-reset）に使用する。
func NewAuthService(
	ownerPool *pgxpool.Pool,
	userRepo domain.UserRepository,
	tenantRepo domain.TenantRepository,
	membershipRepo domain.MembershipRepository,
	refreshTokenRepo domain.RefreshTokenRepository,
	passwordRepo domain.PasswordResetTokenRepository,
	hasher domain.PasswordHasher,
	tokenGen domain.TokenGenerator,
	tokenVerifier domain.TokenVerifier,
) AuthService {
	return &authService{
		ownerPool:        ownerPool,
		userRepo:         userRepo,
		tenantRepo:       tenantRepo,
		membershipRepo:   membershipRepo,
		refreshTokenRepo: refreshTokenRepo,
		passwordRepo:     passwordRepo,
		hasher:           hasher,
		tokenGen:         tokenGen,
		tokenVerifier:    tokenVerifier,
	}
}

// Signup は新規テナントと管理者ユーザーを作成し、認証トークンを返す。
// (a) メール重複チェック（トランザクション外）, (b) パスワードハッシュ化（トランザクション外）,
// (c) トランザクション開始, (d) テナント作成, (e) ユーザー作成,
// (f) メンバーシップ作成(role=admin), (g) リフレッシュトークン保存,
// (h) コミット, (i) アクセストークン生成, (j) AuthResult 返却。
func (s *authService) Signup(ctx context.Context, params SignupParams) (*domain.AuthResult, error) {
	// (a) メール重複チェック（性能のためトランザクション外で実行）。
	existing, err := s.userRepo.GetByEmail(ctx, params.Email)
	if err != nil && !errors.Is(err, domain.ErrResourceNotFound) {
		return nil, fmt.Errorf("authService.Signup: check email: %w", err)
	}
	if existing != nil {
		return nil, domain.ErrEmailAlreadyExists
	}

	// (b) パスワードハッシュ化（性能のためトランザクション外で実行）。
	passwordHash, err := s.hasher.HashPassword(params.Password)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: hash password: %w", err)
	}

	// (c) トランザクション開始（db_schema.md §3.5 集約境界準拠）。
	// ownerPool を使用して RLS の影響を受けずにテナント横断操作を実行する。
	tx, err := s.ownerPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: begin transaction: %w", err)
	}
	// defer でロールバックを保証する。Commit 後は no-op になる。
	defer func() { _ = tx.Rollback(ctx) }()

	// トランザクションをコンテキストに注入してリポジトリ層に伝播する。
	txCtx := middleware.SetTx(ctx, tx)

	// (d) テナント作成。
	tenant, err := s.tenantRepo.Create(txCtx, params.CompanyName)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: create tenant: %w", err)
	}

	// (e) ユーザー作成。
	user, err := s.userRepo.Create(txCtx, params.Email, params.Name, passwordHash)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: create user: %w", err)
	}

	// (f) メンバーシップ作成（role=admin）。
	membership, err := s.membershipRepo.Create(txCtx, tenant.TenantID, user.UserID, domain.RoleAdmin)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: create membership: %w", err)
	}

	// (g) リフレッシュトークン生成・保存（トランザクション内）。
	refreshToken, err := s.tokenGen.GenerateRefreshToken(user.UserID)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: generate refresh token: %w", err)
	}
	rtClaims, err := s.tokenVerifier.VerifyRefreshToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: verify refresh token: %w", err)
	}
	tokenHash := sha256Hex(refreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := s.refreshTokenRepo.Create(txCtx, rtClaims.JTI, user.UserID, tokenHash, expiresAt); err != nil {
		return nil, fmt.Errorf("authService.Signup: save refresh token: %w", err)
	}

	// (h) コミット。
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("authService.Signup: commit transaction: %w", err)
	}

	// (i) アクセストークン生成（コミット後に実施）。
	accessToken, err := s.tokenGen.GenerateAccessToken(user.UserID, tenant.TenantID, membership.Role)
	if err != nil {
		return nil, fmt.Errorf("authService.Signup: generate access token: %w", err)
	}

	// (j) AuthResult 返却。
	result := buildAuthResult(user, tenant, membership.Role, accessToken, refreshToken)
	return result, nil
}

// Login はメールアドレスとパスワードでユーザーを認証し、認証トークンを返す。
// (a) GetByEmail, (b) VerifyPassword, (c) ownerPool からコネクション取得・SetConn,
// (d) GetByUserID(membership), (e) トークン生成・保存, (f) AuthResult 返却。
func (s *authService) Login(ctx context.Context, email, password string) (*domain.AuthResult, error) {
	// (a) メールでユーザーを取得する。存在しない場合は INVALID_CREDENTIALS（SEC-011）。
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			// ユーザー不存在でも Argon2id 検証と同等の計算時間を消費する（SEC-011）。
			_, _ = s.hasher.VerifyPassword(password, dummyHash)
			return nil, domain.ErrInvalidCredentials
		}
		return nil, fmt.Errorf("authService.Login: get user by email: %w", err)
	}

	// (b) パスワード照合。不一致の場合は INVALID_CREDENTIALS（SEC-011）。
	match, err := s.hasher.VerifyPassword(password, user.PasswordHash)
	if err != nil {
		// 不正なハッシュ形式もクライアントには INVALID_CREDENTIALS として返す。
		return nil, domain.ErrInvalidCredentials
	}
	if !match {
		return nil, domain.ErrInvalidCredentials
	}

	// (c) ownerPool から接続を取得してコンテキストに注入する。
	// これにより後続リポジトリ操作が RLS の影響を受けない owner 接続を使用する。
	conn, err := s.ownerPool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("authService.Login: acquire connection: %w", err)
	}
	defer conn.Release()
	ctx = middleware.SetConn(ctx, conn)

	// (d) メンバーシップを取得してテナントとロールを確定する。
	membership, err := s.membershipRepo.GetByUserID(ctx, user.UserID)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			return nil, domain.ErrInvalidCredentials
		}
		return nil, fmt.Errorf("authService.Login: get membership: %w", err)
	}

	// テナント情報を取得する。
	tenant, err := s.tenantRepo.GetByID(ctx, membership.TenantID)
	if err != nil {
		return nil, fmt.Errorf("authService.Login: get tenant: %w", err)
	}

	// (e) トークン生成・保存。
	accessToken, err := s.tokenGen.GenerateAccessToken(user.UserID, tenant.TenantID, membership.Role)
	if err != nil {
		return nil, fmt.Errorf("authService.Login: generate access token: %w", err)
	}

	refreshToken, err := s.tokenGen.GenerateRefreshToken(user.UserID)
	if err != nil {
		return nil, fmt.Errorf("authService.Login: generate refresh token: %w", err)
	}

	rtClaims, err := s.tokenVerifier.VerifyRefreshToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("authService.Login: verify refresh token: %w", err)
	}

	tokenHash := sha256Hex(refreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := s.refreshTokenRepo.Create(ctx, rtClaims.JTI, user.UserID, tokenHash, expiresAt); err != nil {
		return nil, fmt.Errorf("authService.Login: save refresh token: %w", err)
	}

	// (f) AuthResult 返却。
	result := buildAuthResult(user, tenant, membership.Role, accessToken, refreshToken)
	return result, nil
}

// RefreshToken は有効なリフレッシュトークンを使って新しいトークンペアを発行する。
// (a) VerifyRefreshToken, (b) ownerPool からコネクション取得・SetConn,
// (c) GetByJTI, (d) is_revoked チェック,
// (e) 旧トークン revoke, (f) 最新ロール・テナント取得, (g) 新トークン生成・保存。
func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (*domain.AuthResult, error) {
	// (a) トークン検証。
	rtClaims, err := s.tokenVerifier.VerifyRefreshToken(refreshToken)
	if err != nil {
		return nil, err // ErrTokenExpired or ErrInvalidToken をそのまま返す。
	}

	// (b) ownerPool から接続を取得してコンテキストに注入する。
	conn, err := s.ownerPool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: acquire connection: %w", err)
	}
	defer conn.Release()
	ctx = middleware.SetConn(ctx, conn)

	// (c) DB で JTI を検索する。
	storedToken, err := s.refreshTokenRepo.GetByJTI(ctx, rtClaims.JTI)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			return nil, domain.ErrInvalidToken
		}
		return nil, fmt.Errorf("authService.RefreshToken: get refresh token: %w", err)
	}

	// (d) 失効済みチェック。
	// 無効化済みトークンでのリフレッシュ試行はトークン再利用を示す。
	// security.md §2.1 に従い、同一ユーザーの全セッションを無効化する。
	if storedToken.IsRevoked {
		// トークン再利用を検知。同一ユーザーの全セッションを無効化する（security.md §2.1）。
		if err := s.refreshTokenRepo.RevokeAllByUserID(ctx, storedToken.UserID); err != nil {
			slog.Error("リフレッシュトークン再利用検知: 全セッション無効化に失敗", "user_id", storedToken.UserID, "error", err)
		}
		return nil, domain.ErrTokenRevoked
	}

	// (e) 旧トークンを revoke する（トークンローテーション）。
	if err := s.refreshTokenRepo.Revoke(ctx, rtClaims.JTI); err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: revoke old token: %w", err)
	}

	// (f) 最新のロール・テナント情報を取得する。
	membership, err := s.membershipRepo.GetByUserID(ctx, rtClaims.UserID)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: get membership: %w", err)
	}

	tenant, err := s.tenantRepo.GetByID(ctx, membership.TenantID)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: get tenant: %w", err)
	}

	user, err := s.userRepo.GetByID(ctx, rtClaims.UserID)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: get user: %w", err)
	}

	// (g) 新トークン生成・保存。
	newAccessToken, err := s.tokenGen.GenerateAccessToken(user.UserID, tenant.TenantID, membership.Role)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: generate access token: %w", err)
	}

	newRefreshToken, err := s.tokenGen.GenerateRefreshToken(user.UserID)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: generate refresh token: %w", err)
	}

	newRTClaims, err := s.tokenVerifier.VerifyRefreshToken(newRefreshToken)
	if err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: verify new refresh token: %w", err)
	}

	newTokenHash := sha256Hex(newRefreshToken)
	newExpiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := s.refreshTokenRepo.Create(ctx, newRTClaims.JTI, user.UserID, newTokenHash, newExpiresAt); err != nil {
		return nil, fmt.Errorf("authService.RefreshToken: save new refresh token: %w", err)
	}

	result := buildAuthResult(user, tenant, membership.Role, newAccessToken, newRefreshToken)
	return result, nil
}

// Logout は指定されたリフレッシュトークンを無効化する。
// (a) VerifyRefreshToken, (b) ownerPool からコネクション取得・SetConn,
// (c) GetByJTI, (d) is_revoked チェック, (e) Revoke。
func (s *authService) Logout(ctx context.Context, refreshToken string) error {
	// (a) トークン検証。
	rtClaims, err := s.tokenVerifier.VerifyRefreshToken(refreshToken)
	if err != nil {
		return err // ErrTokenExpired or ErrInvalidToken をそのまま返す。
	}

	// (b) ownerPool から接続を取得してコンテキストに注入する。
	conn, err := s.ownerPool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("authService.Logout: acquire connection: %w", err)
	}
	defer conn.Release()
	ctx = middleware.SetConn(ctx, conn)

	// (c) DB で JTI を検索する。
	storedToken, err := s.refreshTokenRepo.GetByJTI(ctx, rtClaims.JTI)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			return domain.ErrInvalidToken
		}
		return fmt.Errorf("authService.Logout: get refresh token: %w", err)
	}

	// (d) 失効済みチェック。
	if storedToken.IsRevoked {
		return domain.ErrTokenRevoked
	}

	// (e) Revoke。
	if err := s.refreshTokenRepo.Revoke(ctx, rtClaims.JTI); err != nil {
		return fmt.Errorf("authService.Logout: revoke token: %w", err)
	}

	return nil
}

// GetMe は認証済みユーザーのプロフィールを返す。
// (a) GetByID(user), (b) GetByID(tenant), (c) UserProfile 構築。
func (s *authService) GetMe(ctx context.Context, actor domain.Actor) (*domain.UserProfile, error) {
	// (a) ユーザー情報を取得する。
	user, err := s.userRepo.GetByID(ctx, actor.UserID)
	if err != nil {
		return nil, fmt.Errorf("authService.GetMe: get user: %w", err)
	}

	// (b) テナント情報を取得する。
	tenant, err := s.tenantRepo.GetByID(ctx, actor.TenantID)
	if err != nil {
		return nil, fmt.Errorf("authService.GetMe: get tenant: %w", err)
	}

	// (c) UserProfile 構築。
	profile := &domain.UserProfile{
		ID:    user.UserID,
		Name:  user.Name,
		Email: user.Email,
		Role:  actor.Role,
	}
	profile.Tenant.ID = tenant.TenantID
	profile.Tenant.Name = tenant.CompanyName

	return profile, nil
}

// RequestPasswordReset はパスワードリセットトークンを生成して DB に保存する。
// MVP ではメール送信はログ出力で代替する。
// (a) ownerPool からコネクション取得・SetConn,
// (b) GetByEmail（存在しなければ成功返却），(c) ランダムトークン生成,
// (d) SHA-256 ハッシュ化→保存, (e) ログ出力。
func (s *authService) RequestPasswordReset(ctx context.Context, email string) error {
	// (a) ownerPool から接続を取得してコンテキストに注入する。
	conn, err := s.ownerPool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("authService.RequestPasswordReset: acquire connection: %w", err)
	}
	defer conn.Release()
	ctx = middleware.SetConn(ctx, conn)

	// (b) ユーザーを取得する。存在しない場合は情報漏洩防止のため何もせず成功返却（SEC-011）。
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			// ユーザーが存在しない場合も成功レスポンスを返す（SEC-011）。
			return nil
		}
		return fmt.Errorf("authService.RequestPasswordReset: get user by email: %w", err)
	}

	// (c) ランダム 32 バイト → hex エンコード（64 文字トークン）。
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return fmt.Errorf("authService.RequestPasswordReset: generate token: %w", err)
	}
	tokenValue := hex.EncodeToString(rawBytes)

	// (d) SHA-256 ハッシュ化して DB に保存する。有効期限: 1 時間。
	tokenHash := sha256Hex(tokenValue)
	expiresAt := time.Now().Add(1 * time.Hour)
	if _, err := s.passwordRepo.Create(ctx, user.UserID, tokenHash, expiresAt); err != nil {
		return fmt.Errorf("authService.RequestPasswordReset: save token: %w", err)
	}

	// (e) MVP: メール送信はログ出力で代替する。
	slog.Info("パスワードリセットトークンを生成しました", "email", email, "token", tokenValue)

	return nil
}

// ExecutePasswordReset はトークンを検証してパスワードを更新する。
// (a) 入力トークンの SHA-256 ハッシュ化, (b) GetByTokenHash,
// (c) UsedAt 非nil → ErrInvalidToken, (d) ExpiresAt < now → ErrTokenExpired,
// (e) 新パスワードハッシュ化, (f) ownerPool でトランザクション開始,
// (g) UpdatePassword, (h) MarkUsed, (i) RevokeAllByUserID, (j) コミット。
func (s *authService) ExecutePasswordReset(ctx context.Context, token, newPassword string) error {
	// (a) 入力トークンを SHA-256 でハッシュ化する。
	tokenHash := sha256Hex(token)

	// (b) DB でトークンを検索する。
	// GetByTokenHash は used_at IS NULL AND expires_at > now() の条件で検索するため、
	// 期限切れ・使用済みのトークンはここで ErrResourceNotFound が返る場合がある。
	storedToken, err := s.passwordRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, domain.ErrResourceNotFound) {
			// テストケースにより、期限切れ・使用済みトークンは適切なエラーを返す必要がある。
			// GetByTokenHash がフィルタしてしまう場合は後続チェックに到達できないため、
			// INVALID_TOKEN を返す。
			return domain.ErrInvalidToken
		}
		return fmt.Errorf("authService.ExecutePasswordReset: get token: %w", err)
	}

	// (c) 使用済みチェック。
	if storedToken.UsedAt != nil {
		return domain.ErrInvalidToken
	}

	// (d) 有効期限チェック。
	if time.Now().After(storedToken.ExpiresAt) {
		return domain.ErrTokenExpired
	}

	// (e) 新パスワードハッシュ化（トランザクション外で実行して計算コストを分離する）。
	newHash, err := s.hasher.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("authService.ExecutePasswordReset: hash password: %w", err)
	}

	// (f) ownerPool でトランザクション開始（複数書き込みを原子化する）。
	tx, err := s.ownerPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("authService.ExecutePasswordReset: begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txCtx := middleware.SetTx(ctx, tx)

	// (g) パスワード更新。
	if err := s.userRepo.UpdatePassword(txCtx, storedToken.UserID, newHash); err != nil {
		return fmt.Errorf("authService.ExecutePasswordReset: update password: %w", err)
	}

	// (h) トークンを使用済みとしてマーク。
	if err := s.passwordRepo.MarkUsed(txCtx, storedToken.ID); err != nil {
		return fmt.Errorf("authService.ExecutePasswordReset: mark used: %w", err)
	}

	// (i) ユーザーの全リフレッシュトークンを失効させる（security.md §2.3）。
	if err := s.refreshTokenRepo.RevokeAllByUserID(txCtx, storedToken.UserID); err != nil {
		return fmt.Errorf("authService.ExecutePasswordReset: revoke all tokens: %w", err)
	}

	// (j) コミット。
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("authService.ExecutePasswordReset: commit transaction: %w", err)
	}

	return nil
}

// sha256Hex は文字列を SHA-256 でハッシュ化して hex 文字列で返す内部ヘルパー。
func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// buildAuthResult は AuthResult を構築するヘルパー。
func buildAuthResult(user *domain.User, tenant *domain.Tenant, role domain.Role, accessToken, refreshToken string) *domain.AuthResult {
	result := &domain.AuthResult{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}
	result.User.ID = user.UserID
	result.User.Name = user.Name
	result.User.Email = user.Email
	result.User.Role = role
	result.Tenant.ID = tenant.TenantID
	result.Tenant.Name = tenant.CompanyName
	return result
}

