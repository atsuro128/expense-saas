import { api } from './client';
import { setTokens, clearTokens, getRefreshToken, setCurrentUser } from '../stores/auth';
import type { AuthTokens, AuthUser, ApiResponse } from './types';

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api.post<ApiResponse<AuthTokens>>('/api/auth/login', { email, password });
  setTokens(res.data.access_token, res.data.refresh_token);
  const me = await api.get<ApiResponse<AuthUser>>('/api/auth/me');
  // ユーザー情報を auth store に保持（AppLayout のヘッダー表示で使用）
  setCurrentUser(me.data);
  return me.data;
}

export async function logout(): Promise<void> {
  const rt = getRefreshToken();
  try {
    await api.post('/api/auth/logout', { refresh_token: rt });
  } finally {
    clearTokens();
  }
}

export async function healthCheck(): Promise<{ status: string; checks: { database: string } }> {
  return api.get('/health');
}
