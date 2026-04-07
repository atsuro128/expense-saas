// カテゴリ一覧取得 React Query Hook。
// state-management.md §3 データフェッチ系に準拠する。
// queryKey: ['categories']
// staleTime: Infinity（カテゴリはマスタデータのため固定）

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, Category } from '../api/types';

// useCategories: GET /api/categories — カテゴリ一覧を取得する Hook。
// staleTime は Infinity（マスタデータのため再フェッチ不要）。
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const res = await api.get<ApiResponse<Category[]>>('/api/categories');
      return res.data;
    },
    staleTime: Infinity,
  });
}
