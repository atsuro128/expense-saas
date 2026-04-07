// ダッシュボードデータ取得フック。
// GET /api/dashboard を React Query でフェッチし、ロール別レスポンスを返す。
// 55_ui_component/state-management.md §useDashboard 準拠。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, DashboardResponse } from '../api/types';
import { ApiClientError } from '../api/client';

/**
 * useDashboard は GET /api/dashboard を呼び出してダッシュボードデータを返す。
 * staleTime: 60 秒のキャッシュを設定する。
 */
export function useDashboard() {
  return useQuery<ApiResponse<DashboardResponse>, ApiClientError>({
    queryKey: ['dashboard'],
    queryFn: () => api.get<ApiResponse<DashboardResponse>>('/api/dashboard'),
    staleTime: 60 * 1000,
  });
}
