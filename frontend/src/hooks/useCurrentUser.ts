// 現在ログインユーザー情報取得フック。
// GET /api/auth/me を React Query でフェッチし、ユーザー情報（ロール等）を返す。
// 55_ui_component/state-management.md §useCurrentUser 準拠。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AuthUser } from '../api/types';
import { ApiClientError } from '../api/client';

/**
 * useCurrentUser は GET /api/auth/me を呼び出して現在のユーザー情報を返す。
 * staleTime: 5 分のキャッシュを設定する。
 */
export function useCurrentUser() {
  return useQuery<ApiResponse<AuthUser>, ApiClientError>({
    queryKey: ['currentUser'],
    queryFn: () => api.get<ApiResponse<AuthUser>>('/api/auth/me'),
    staleTime: 5 * 60 * 1000,
  });
}
