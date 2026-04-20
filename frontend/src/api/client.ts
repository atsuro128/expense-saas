import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../stores/auth';
import type { ApiError, ValidationError, AuthTokens } from './types';
import { SERVER_ERROR_MESSAGES, inferCodeFromStatus } from '../lib/error-messages';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: ValidationError[],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) {
    clearTokens();
    window.location.href = '/login';
    return false;
  }
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) {
      clearTokens();
      window.location.href = '/login';
      return false;
    }
    const body = (await res.json()) as { data: AuthTokens };
    setTokens(body.data.access_token, body.data.refresh_token);
    return true;
  } catch {
    clearTokens();
    window.location.href = '/login';
    return false;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};

  const isFormData = init.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // AbortSignal が渡された場合、fetch に signal を伝播させる。
  const res = await fetch(path, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401) {
    // /api/auth/login および /api/auth/refresh の 401 はリフレッシュ処理をスキップして
    // 呼び出し元にそのまま ApiClientError を投げる。
    // - login: 誤認証情報によるエラー。リフレッシュ不要。
    // - refresh: リフレッシュトークン失効によるエラー。無限ループを防ぐためスキップ必須。
    const isAuthEndpoint = path === '/api/auth/login' || path === '/api/auth/refresh';
    if (isAuthEndpoint) {
      await handleErrorResponse(res);
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new ApiClientError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const retryHeaders: Record<string, string> = { ...headers };
    const newToken = getAccessToken();
    if (newToken) {
      retryHeaders['Authorization'] = `Bearer ${newToken}`;
    }
    const retryRes = await fetch(path, {
      ...init,
      headers: {
        ...retryHeaders,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!retryRes.ok) {
      await handleErrorResponse(retryRes);
    }
    if (retryRes.status === 204 || retryRes.headers.get('content-length') === '0') {
      return undefined as T;
    }
    return retryRes.json() as Promise<T>;
  }

  if (!res.ok) {
    await handleErrorResponse(res);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

async function handleErrorResponse(res: Response): Promise<never> {
  let code = 'INTERNAL_ERROR';
  let serverMessage: string | undefined;
  let details: ValidationError[] | undefined;
  try {
    const body = (await res.json()) as ApiError;
    // JSON パース成功時: レスポンスボディからコードとメッセージを取得する。
    code = body.error.code;
    serverMessage = body.error.message;
    details = body.error.details;
  } catch {
    // JSON パース失敗時: HTTP ステータスコードからエラーコードを推定する。
    // Vite dev proxy が非 JSON の 500 を返す場合等に該当する。
    code = inferCodeFromStatus(res.status);
  }

  // 文言決定ロジック:
  // - VALIDATION_ERROR: フィールド情報を含むサーバー側 message を優先する。
  // - それ以外: SERVER_ERROR_MESSAGES[code] を使用する。
  //   未知コードの場合は INTERNAL_ERROR 文言にフォールバックする。
  const message =
    code === 'VALIDATION_ERROR'
      ? (serverMessage ?? SERVER_ERROR_MESSAGES['VALIDATION_ERROR'])
      : (SERVER_ERROR_MESSAGES[code] ?? SERVER_ERROR_MESSAGES['INTERNAL_ERROR']);

  throw new ApiClientError(message, res.status, code, details);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiClient<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiClient<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiClient<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    }),
  delete: <T>(path: string, signal?: AbortSignal) => apiClient<T>(path, { method: 'DELETE', signal }),
};
