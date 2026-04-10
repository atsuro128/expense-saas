package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// AuthHandler は認証関連エンドポイントの handler です。
type AuthHandler struct {
	svc service.AuthService
}

// NewAuthHandler は AuthHandler を生成して返します。
func NewAuthHandler(svc service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// emailRegex はメールアドレスの簡易バリデーション用正規表現。
var emailRegex = regexp.MustCompile(`^[^@]+@[^@]+\.[^@]+$`)

// isValidEmail はメールアドレス形式の基本チェックを行う。
func isValidEmail(email string) bool {
	if email == "" {
		return false
	}
	if utf8.RuneCountInString(email) > 254 {
		return false
	}
	return emailRegex.MatchString(email)
}

// signupRequest は POST /api/auth/signup のリクエストボディ。
type signupRequest struct {
	CompanyName string `json:"company_name"`
	UserName    string `json:"user_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

// Signup は POST /api/auth/signup を処理します。
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "リクエストボディの JSON 解析に失敗しました")
		return
	}

	// バリデーション。
	var details []middleware.ValidationError

	companyLen := utf8.RuneCountInString(req.CompanyName)
	if companyLen == 0 {
		details = append(details, middleware.ValidationError{Field: "company_name", Message: "company_name は必須です"})
	} else if companyLen > 200 {
		details = append(details, middleware.ValidationError{Field: "company_name", Message: "company_name は 200 文字以内で入力してください"})
	}

	userNameLen := utf8.RuneCountInString(req.UserName)
	if userNameLen == 0 {
		details = append(details, middleware.ValidationError{Field: "user_name", Message: "user_name は必須です"})
	} else if userNameLen > 100 {
		details = append(details, middleware.ValidationError{Field: "user_name", Message: "user_name は 100 文字以内で入力してください"})
	}

	if req.Email == "" {
		details = append(details, middleware.ValidationError{Field: "email", Message: "email は必須です"})
	} else if !isValidEmail(req.Email) {
		details = append(details, middleware.ValidationError{Field: "email", Message: "email の形式が不正です"})
	}

	pwLen := utf8.RuneCountInString(req.Password)
	if pwLen < 8 {
		details = append(details, middleware.ValidationError{Field: "password", Message: "password は 8 文字以上で入力してください"})
	} else if pwLen > 128 {
		details = append(details, middleware.ValidationError{Field: "password", Message: "password は 128 文字以内で入力してください"})
	}

	if len(details) > 0 {
		middleware.RespondJSON(w, http.StatusUnprocessableEntity, middleware.ErrorResponse{
			Error: middleware.ErrorBody{
				Code:    "VALIDATION_ERROR",
				Message: "入力値に誤りがあります",
				Details: details,
			},
		})
		return
	}

	result, err := h.svc.Signup(r.Context(), service.SignupParams{
		CompanyName: req.CompanyName,
		Email:       req.Email,
		Name:        req.UserName,
		Password:    req.Password,
	})
	if err != nil {
		h.handleAuthError(w, err, false)
		return
	}

	middleware.RespondJSON(w, http.StatusCreated, map[string]any{"data": result})
}

// loginRequest は POST /api/auth/login のリクエストボディ。
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login は POST /api/auth/login を処理します。
// SEC-011: メール形式不正でも 401 を返す。400 は JSON パースエラーと必須フィールド欠落のみ。
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "リクエストボディの JSON 解析に失敗しました")
		return
	}

	// 必須フィールド欠落のみ 400 で返す（SEC-011 準拠）。
	if req.Email == "" {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "email は必須です")
		return
	}
	if req.Password == "" {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "password は必須です")
		return
	}

	// メール形式不正はサービス層で INVALID_CREDENTIALS として処理する（SEC-011）。
	result, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		h.handleAuthError(w, err, false)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": result})
}

// refreshTokenRequest は POST /api/auth/refresh のリクエストボディ。
type refreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// RefreshToken は POST /api/auth/refresh を処理します。
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req refreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "リクエストボディの JSON 解析に失敗しました")
		return
	}

	if req.RefreshToken == "" {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "refresh_token は必須です")
		return
	}

	result, err := h.svc.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		h.handleAuthError(w, err, false)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": result})
}

// logoutRequest は POST /api/auth/logout のリクエストボディ。
type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Logout は POST /api/auth/logout を処理します。
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "リクエストボディの JSON 解析に失敗しました")
		return
	}

	if req.RefreshToken == "" {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "refresh_token は必須です")
		return
	}

	if err := h.svc.Logout(r.Context(), req.RefreshToken); err != nil {
		h.handleAuthError(w, err, false)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"message": "ログアウトしました"}})
}

// GetMe は GET /api/auth/me を処理します。
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "認証情報が不正です")
		return
	}

	profile, err := h.svc.GetMe(r.Context(), actor)
	if err != nil {
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error")
		return
	}

	// openapi.yaml UserProfile スキーマに準拠したレスポンスを返す。
	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": profile})
}

// passwordResetRequest は POST /api/auth/password-reset のリクエストボディ。
type passwordResetRequest struct {
	Email string `json:"email"`
}

// RequestPasswordReset は POST /api/auth/password-reset を処理します。
func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req passwordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "リクエストボディの JSON 解析に失敗しました")
		return
	}

	// email バリデーション。
	var details []middleware.ValidationError
	if req.Email == "" {
		details = append(details, middleware.ValidationError{Field: "email", Message: "email は必須です"})
	} else if !isValidEmail(req.Email) {
		details = append(details, middleware.ValidationError{Field: "email", Message: "email の形式が不正です"})
	}

	if len(details) > 0 {
		middleware.RespondJSON(w, http.StatusUnprocessableEntity, middleware.ErrorResponse{
			Error: middleware.ErrorBody{
				Code:    "VALIDATION_ERROR",
				Message: "入力値に誤りがあります",
				Details: details,
			},
		})
		return
	}

	if err := h.svc.RequestPasswordReset(r.Context(), req.Email); err != nil {
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error")
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{
		"data": map[string]string{"message": "パスワードリセットメールを送信しました"},
	})
}

// executePasswordResetRequest は PUT /api/auth/password-reset/{token} のリクエストボディ。
type executePasswordResetRequest struct {
	NewPassword string `json:"new_password"`
}

// ExecutePasswordReset は PUT /api/auth/password-reset/{token} を処理します。
func (h *AuthHandler) ExecutePasswordReset(w http.ResponseWriter, r *http.Request) {
	// URL パラメータからトークンを取得する。
	token := chi.URLParam(r, "token")
	if token == "" {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "token は必須です")
		return
	}

	var req executePasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusBadRequest, "BAD_REQUEST", "リクエストボディの JSON 解析に失敗しました")
		return
	}

	// new_password バリデーション（8〜128 文字）。
	var details []middleware.ValidationError
	pwLen := utf8.RuneCountInString(req.NewPassword)
	if pwLen == 0 {
		details = append(details, middleware.ValidationError{Field: "new_password", Message: "new_password は必須です"})
	} else if pwLen < 8 {
		details = append(details, middleware.ValidationError{Field: "new_password", Message: "new_password は 8 文字以上で入力してください"})
	} else if pwLen > 128 {
		details = append(details, middleware.ValidationError{Field: "new_password", Message: "new_password は 128 文字以内で入力してください"})
	}

	if len(details) > 0 {
		middleware.RespondJSON(w, http.StatusUnprocessableEntity, middleware.ErrorResponse{
			Error: middleware.ErrorBody{
				Code:    "VALIDATION_ERROR",
				Message: "入力値に誤りがあります",
				Details: details,
			},
		})
		return
	}

	if err := h.svc.ExecutePasswordReset(r.Context(), token, req.NewPassword); err != nil {
		h.handleAuthError(w, err, true)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{
		"data": map[string]string{"message": "パスワードをリセットしました"},
	})
}

// handleAuthError はサービス層のエラーを HTTP レスポンスにマッピングする。
// isPasswordReset が true の場合、トークン関連エラーは 422 で返す。
func (h *AuthHandler) handleAuthError(w http.ResponseWriter, err error, isPasswordReset bool) {
	switch {
	case errors.Is(err, domain.ErrEmailAlreadyExists):
		middleware.RespondError(w, http.StatusConflict, "EMAIL_ALREADY_EXISTS", "このメールアドレスは既に登録されています")
	case errors.Is(err, domain.ErrInvalidCredentials):
		middleware.RespondError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "メールアドレスまたはパスワードが正しくありません")
	case errors.Is(err, domain.ErrInvalidToken):
		if isPasswordReset {
			// パスワードリセットのトークンエラーは 422。
			middleware.RespondError(w, http.StatusUnprocessableEntity, "INVALID_TOKEN", "トークンが無効です")
		} else {
			middleware.RespondError(w, http.StatusUnauthorized, "INVALID_TOKEN", "トークンが無効です")
		}
	case errors.Is(err, domain.ErrTokenExpired):
		if isPasswordReset {
			// パスワードリセットの期限切れトークンは FE・画面仕様（auth-password-reset.md §10/§11）に合わせて
			// INVALID_TOKEN で返す。期限切れも無効トークンも「無効なリンク」として同一扱いする。
			middleware.RespondError(w, http.StatusUnprocessableEntity, "INVALID_TOKEN", "トークンが無効または期限切れです")
		} else {
			middleware.RespondError(w, http.StatusUnauthorized, "TOKEN_EXPIRED", "トークンの有効期限が切れています")
		}
	case errors.Is(err, domain.ErrTokenRevoked):
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "トークンは既に無効化されています")
	default:
		middleware.RespondError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "internal server error")
	}
}
