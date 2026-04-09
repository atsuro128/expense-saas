package handler

import (
	"encoding/json"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"expense-saas/internal/domain"
	"expense-saas/internal/middleware"
	"expense-saas/internal/service"
)

// ItemHandler は経費明細エンドポイントの handler です。
type ItemHandler struct {
	svc service.ItemService
}

// NewItemHandler は ItemHandler を生成して返します。
func NewItemHandler(svc service.ItemService) *ItemHandler {
	return &ItemHandler{svc: svc}
}

// itemResponse は POST/PUT の明細レスポンスを openapi.yaml の ExpenseItem 契約に合わせる構造体。
// ExpenseItemDTO から attachments を除外し、expense_date を YYYY-MM-DD 形式に変換する。
type itemResponse struct {
	ID          uuid.UUID  `json:"id"`
	ReportID    uuid.UUID  `json:"report_id"`
	ExpenseDate string     `json:"expense_date"`
	Amount      int        `json:"amount"`
	Category    any        `json:"category"`
	Description string     `json:"description"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// toItemResponse は ExpenseItemDTO を API 契約準拠のレスポンスに変換する。
func toItemResponse(dto *domain.ExpenseItemDTO) itemResponse {
	return itemResponse{
		ID:          dto.ID,
		ReportID:    dto.ReportID,
		ExpenseDate: dto.ExpenseDate.Format("2006-01-02"),
		Amount:      dto.Amount,
		Category:    dto.Category,
		Description: dto.Description,
		CreatedAt:   dto.CreatedAt,
		UpdatedAt:   dto.UpdatedAt,
	}
}

// createItemRequest は POST /api/reports/{id}/items のリクエストボディを表します。
type createItemRequest struct {
	ExpenseDate string `json:"expense_date"`
	Amount      int    `json:"amount"`
	CategoryID  string `json:"category_id"`
	Description string `json:"description"`
}

// CreateItem は POST /api/reports/{id}/items を処理します。
func (h *ItemHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	var req createItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	// バリデーション（details 付きエラーを収集する）。
	var details []middleware.ValidationError

	// expense_date: 必須、YYYY-MM-DD 形式
	var expenseDate time.Time
	if req.ExpenseDate == "" {
		details = append(details, middleware.ValidationError{
			Field:   "expense_date",
			Message: "expense_date は必須です",
		})
	} else {
		parsed, parseErr := time.Parse("2006-01-02", req.ExpenseDate)
		if parseErr != nil {
			details = append(details, middleware.ValidationError{
				Field:   "expense_date",
				Message: "expense_date は YYYY-MM-DD 形式でなければなりません",
			})
		} else {
			expenseDate = parsed
		}
	}

	// amount: 必須、正の整数 (> 0)
	if req.Amount <= 0 {
		details = append(details, middleware.ValidationError{
			Field:   "amount",
			Message: "amount は正の整数でなければなりません",
		})
	}

	// category_id: 必須、UUID 形式
	var categoryID uuid.UUID
	if req.CategoryID == "" {
		details = append(details, middleware.ValidationError{
			Field:   "category_id",
			Message: "category_id は必須です",
		})
	} else {
		parsed, parseErr := uuid.Parse(req.CategoryID)
		if parseErr != nil {
			details = append(details, middleware.ValidationError{
				Field:   "category_id",
				Message: "category_id は UUID 形式でなければなりません",
			})
		} else {
			categoryID = parsed
		}
	}

	// description: 必須、1-500 文字
	descLen := utf8.RuneCountInString(req.Description)
	if req.Description == "" {
		details = append(details, middleware.ValidationError{
			Field:   "description",
			Message: "description は必須です",
		})
	} else if descLen > 500 {
		details = append(details, middleware.ValidationError{
			Field:   "description",
			Message: "description は 500 文字以内でなければなりません",
		})
	}

	if len(details) > 0 {
		middleware.RespondJSON(w, http.StatusUnprocessableEntity, middleware.ErrorResponse{
			Error: middleware.ErrorBody{
				Code:    "VALIDATION_ERROR",
				Message: "入力パラメータに誤りがあります",
				Details: details,
			},
		})
		return
	}

	params := service.CreateItemParams{
		ExpenseDate: expenseDate,
		Amount:      req.Amount,
		CategoryID:  categoryID,
		Description: req.Description,
	}

	dto, err := h.svc.CreateItem(r.Context(), actor, reportID, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusCreated, map[string]any{"data": toItemResponse(dto)})
}

// updateItemRequest は PUT /api/reports/{id}/items/{itemId} のリクエストボディを表します。
type updateItemRequest struct {
	ExpenseDate string `json:"expense_date"`
	Amount      int    `json:"amount"`
	CategoryID  string `json:"category_id"`
	Description string `json:"description"`
	UpdatedAt   string `json:"updated_at"`
}

// UpdateItem は PUT /api/reports/{id}/items/{itemId} を処理します。
func (h *ItemHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid item id")
		return
	}

	var req updateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid request body")
		return
	}

	// バリデーション（details 付きエラーを収集する）。
	var details []middleware.ValidationError

	// expense_date: 必須、YYYY-MM-DD 形式
	var expenseDate time.Time
	if req.ExpenseDate == "" {
		details = append(details, middleware.ValidationError{
			Field:   "expense_date",
			Message: "expense_date は必須です",
		})
	} else {
		parsed, parseErr := time.Parse("2006-01-02", req.ExpenseDate)
		if parseErr != nil {
			details = append(details, middleware.ValidationError{
				Field:   "expense_date",
				Message: "expense_date は YYYY-MM-DD 形式でなければなりません",
			})
		} else {
			expenseDate = parsed
		}
	}

	// amount: 必須、正の整数 (> 0)
	if req.Amount <= 0 {
		details = append(details, middleware.ValidationError{
			Field:   "amount",
			Message: "amount は正の整数でなければなりません",
		})
	}

	// category_id: 必須、UUID 形式
	var categoryID uuid.UUID
	if req.CategoryID == "" {
		details = append(details, middleware.ValidationError{
			Field:   "category_id",
			Message: "category_id は必須です",
		})
	} else {
		parsed, parseErr := uuid.Parse(req.CategoryID)
		if parseErr != nil {
			details = append(details, middleware.ValidationError{
				Field:   "category_id",
				Message: "category_id は UUID 形式でなければなりません",
			})
		} else {
			categoryID = parsed
		}
	}

	// description: 必須、1-500 文字
	descLen := utf8.RuneCountInString(req.Description)
	if req.Description == "" {
		details = append(details, middleware.ValidationError{
			Field:   "description",
			Message: "description は必須です",
		})
	} else if descLen > 500 {
		details = append(details, middleware.ValidationError{
			Field:   "description",
			Message: "description は 500 文字以内でなければなりません",
		})
	}

	// updated_at: 必須、RFC3339 形式（楽観的ロック用）
	var updatedAt time.Time
	if req.UpdatedAt == "" {
		details = append(details, middleware.ValidationError{
			Field:   "updated_at",
			Message: "updated_at は必須です",
		})
	} else {
		parsed, parseErr := time.Parse(time.RFC3339, req.UpdatedAt)
		if parseErr != nil {
			// RFC3339Nano も試みる。
			parsed, parseErr = time.Parse(time.RFC3339Nano, req.UpdatedAt)
			if parseErr != nil {
				details = append(details, middleware.ValidationError{
					Field:   "updated_at",
					Message: "updated_at は RFC3339 形式でなければなりません",
				})
			} else {
				updatedAt = parsed.UTC()
			}
		} else {
			updatedAt = parsed.UTC()
		}
	}

	if len(details) > 0 {
		middleware.RespondJSON(w, http.StatusUnprocessableEntity, middleware.ErrorResponse{
			Error: middleware.ErrorBody{
				Code:    "VALIDATION_ERROR",
				Message: "入力パラメータに誤りがあります",
				Details: details,
			},
		})
		return
	}

	params := service.UpdateItemParams{
		ExpenseDate: expenseDate,
		Amount:      req.Amount,
		CategoryID:  categoryID,
		Description: req.Description,
		UpdatedAt:   updatedAt,
	}

	dto, err := h.svc.UpdateItem(r.Context(), actor, reportID, itemID, params)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]any{"data": toItemResponse(dto)})
}

// DeleteItem は DELETE /api/reports/{id}/items/{itemId} を処理します。
func (h *ItemHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	actor, ok := actorFromRequest(r)
	if !ok {
		middleware.RespondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
		return
	}

	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid report id")
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		middleware.RespondError(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid item id")
		return
	}

	if err := h.svc.DeleteItem(r.Context(), actor, reportID, itemID); err != nil {
		respondDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
