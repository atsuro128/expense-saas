import type { AuthUser } from '../api/types';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: AuthUser | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
}

/** login 成功時に /api/auth/me で取得したユーザー情報を保持する */
export function setCurrentUser(user: AuthUser): void {
  currentUser = user;
}

/** 現在のログインユーザー情報を返す */
export function getCurrentUser(): AuthUser | null {
  return currentUser;
}
