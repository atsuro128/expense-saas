// カテゴリ一覧取得 React Query Hook のスタブ実装。
// 本実装は Step 10 で行う。現時点では型定義のみを提供し、テスト時には vi.mock でモックする。
// state-management.md §3 データフェッチ系に準拠する。
// queryKey: ['categories']
// staleTime: Infinity（カテゴリはマスタデータのため固定）

import type { ApiResponse, Category } from '../api/types';
import type { UseQueryResult } from '@tanstack/react-query';

// useCategories: GET /api/categories — カテゴリ一覧を取得する Hook のスタブ。
// staleTime は Infinity（マスタデータ）。
export function useCategories(): UseQueryResult<ApiResponse<Category[]>> {
  throw new Error('useCategories is not implemented yet');
}
