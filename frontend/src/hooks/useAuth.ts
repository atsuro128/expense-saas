import { getAccessToken } from '../stores/auth';

/** 現在の認証状態を返す Hook */
export function useAuth(): { isAuthenticated: boolean } {
  const isAuthenticated = getAccessToken() !== null;
  return { isAuthenticated };
}
