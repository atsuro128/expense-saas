// useCurrentUser Hook: GET /api/auth/me を呼び出して現在のユーザー情報を取得する。
// 全認証ロールが利用可能。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AuthUser } from '../api/types';

/**
 * useCurrentUser は GET /api/auth/me を呼び出すクエリ Hook。
 * 現在のユーザー情報（id, name, email, role, tenant）を返す。
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AuthUser>>('/api/auth/me');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
