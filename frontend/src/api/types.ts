// 成功レスポンス（単一リソース）
export interface ApiResponse<T> {
  data: T;
}

// 成功レスポンス（一覧、カーソルベースページネーション）
export interface ApiListResponse<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

// エラーレスポンス
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// 認証トークンペア（AuthTokens スキーマ: POST /api/auth/login, /api/auth/refresh のレスポンスデータ）
export interface AuthTokens {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'approver' | 'member' | 'accounting';
  };
  tenant: {
    id: string;
    name: string;
  };
  access_token: string;
  refresh_token: string;
}

// ユーザー情報（UserProfile スキーマ: GET /api/auth/me のレスポンスデータ）
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'approver' | 'member' | 'accounting';
  tenant: {
    id: string;
    name: string;
  };
}
