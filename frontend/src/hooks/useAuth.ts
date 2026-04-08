import { getAccessToken, getCurrentUser } from '../stores/auth';
import type { AuthUser } from '../api/types';

/** 現在の認証状態と認証ユーザー情報を返す Hook */
export function useAuth(): { isAuthenticated: boolean; user: AuthUser | null } {
  const isAuthenticated = getAccessToken() !== null;
  const user = getCurrentUser();
  return { isAuthenticated, user };
}
