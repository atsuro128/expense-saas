import { getAccessToken } from '../stores/auth';

export function useAuth() {
  const isAuthenticated = getAccessToken() !== null;
  return { isAuthenticated };
}
