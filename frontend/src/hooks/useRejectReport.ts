// 経費レポート却下ミューテーション Hook。
// POST /api/workflow/:id/reject を呼び出して却下処理を行う。
// state-management.md §useRejectReport 準拠。

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, ExpenseReportDetail } from '../api/types';
import type { ApiClientError } from '../api/client';

/** useRejectReport の入力型。 */
export interface RejectReportInput {
  /** 却下対象レポート ID */
  id: string;
  /** 却下理由（必須） */
  reason: string;
  /** 楽観的ロック用タイムスタンプ */
  updated_at: string;
}

/**
 * useRejectReport は POST /api/workflow/:id/reject を呼び出すミューテーション Hook。
 * 成功後に関連クエリキャッシュを無効化する:
 * - ['reports', 'detail', id]
 * - ['workflow', 'pending']
 * - ['dashboard']
 */
export function useRejectReport() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ExpenseReportDetail>, ApiClientError, RejectReportInput>({
    mutationFn: async (input: RejectReportInput) => {
      return api.post<ApiResponse<ExpenseReportDetail>>(`/api/workflow/${input.id}/reject`, {
        reason: input.reason,
        updated_at: input.updated_at,
      });
    },
    onSuccess: (_data, variables) => {
      // state-management.md §ミューテーション後のキャッシュ無効化: useRejectReport
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'pending'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
