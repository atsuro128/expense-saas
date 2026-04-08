// 経費レポート支払完了ミューテーション Hook。
// POST /api/workflow/:id/pay を呼び出して支払完了処理を行う。
// state-management.md §useMarkAsPaid 準拠。

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, ExpenseReportDetail } from '../api/types';
import type { ApiClientError } from '../api/client';

/** useMarkAsPaid の入力型。 */
export interface MarkAsPaidInput {
  /** 支払完了対象レポート ID */
  id: string;
  /** 楽観的ロック用タイムスタンプ */
  updated_at: string;
}

/**
 * useMarkAsPaid は POST /api/workflow/:id/pay を呼び出すミューテーション Hook。
 * 成功後に関連クエリキャッシュを無効化する:
 * - ['reports', 'detail', id]
 * - ['workflow', 'payable']
 * - ['dashboard']
 * - ['reports', 'all']
 */
export function useMarkAsPaid() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ExpenseReportDetail>, ApiClientError, MarkAsPaidInput>({
    mutationFn: async (input: MarkAsPaidInput) => {
      return api.post<ApiResponse<ExpenseReportDetail>>(`/api/workflow/${input.id}/pay`, {
        updated_at: input.updated_at,
      });
    },
    onSuccess: (_data, variables) => {
      // state-management.md §ミューテーション後のキャッシュ無効化: useMarkAsPaid
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'payable'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'all'] });
    },
  });
}
