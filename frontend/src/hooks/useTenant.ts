// useTenant Hook: GET /api/tenant を呼び出してテナント情報を取得する。
// Admin ロールのみ利用可能（authz.md §6.7）。
// staleTime: 5分（300000ms）。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, TenantInfo } from '../api/types';

/**
 * useTenant は GET /api/tenant を呼び出すクエリ Hook。
 * テナント情報（id, name, created_at）を返す。
 * staleTime は 5 分に設定する。
 */
export function useTenant() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      return api.get<ApiResponse<TenantInfo>>('/api/tenant');
    },
    staleTime: 5 * 60 * 1000,
  });
}
