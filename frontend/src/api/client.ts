import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../stores/auth';
import type { ApiError, ValidationError, AuthTokens } from './types';

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

  const res = await fetch(path, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401) {
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
  let code = 'UNKNOWN_ERROR';
  let message = res.statusText;
  let details: ValidationError[] | undefined;
  try {
    const body = (await res.json()) as ApiError;
    code = body.error.code;
    message = body.error.message;
    details = body.error.details;
  } catch {
    // レスポンスボディが JSON でない場合はデフォルト値を使用
  }
  throw new ApiClientError(message, res.status, code, details);
}

export const api = {
  get: <T>(path: string) => apiClient<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => apiClient<T>(path, { method: 'DELETE' }),
};
