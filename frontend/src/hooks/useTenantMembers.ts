// useTenantMembers Hook: GET /api/tenant/members を呼び出してテナントメンバー一覧を取得する。
// Admin および Accounting ロールが利用可能（authz.md §6.7）。
// staleTime: 60秒（60000ms）。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, UserSummary } from '../api/types';

/**
 * useTenantMembers は GET /api/tenant/members を呼び出すクエリ Hook。
 * テナント内のメンバー一覧（UserSummary 配列）を返す。
 * staleTime は 60 秒に設定する。
 */
export function useTenantMembers() {
  return useQuery({
    queryKey: ['tenantMembers'],
    queryFn: async () => {
      return api.get<ApiResponse<UserSummary[]>>('/api/tenant/members');
    },
    staleTime: 60 * 1000,
  });
}
