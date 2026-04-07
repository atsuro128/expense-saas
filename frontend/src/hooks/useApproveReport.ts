// 経費レポート承認ミューテーション Hook。
// POST /api/workflow/:id/approve を呼び出して承認処理を行う。
// state-management.md §useApproveReport 準拠。

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, ExpenseReportDetail } from '../api/types';
import type { ApiClientError } from '../api/client';

/** useApproveReport の入力型。 */
export interface ApproveReportInput {
  /** 承認対象レポート ID */
  id: string;
  /** 承認コメント（任意） */
  comment?: string;
  /** 楽観的ロック用タイムスタンプ */
  updated_at: string;
}

/**
 * useApproveReport は POST /api/workflow/:id/approve を呼び出すミューテーション Hook。
 * 成功後に関連クエリキャッシュを無効化する:
 * - ['reports', 'detail', id]
 * - ['workflow', 'pending']
 * - ['workflow', 'payable']
 * - ['dashboard']
 */
export function useApproveReport() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ExpenseReportDetail>, ApiClientError, ApproveReportInput>({
    mutationFn: async (input: ApproveReportInput) => {
      // リクエストボディを組み立てる。comment は省略可能。
      const body: Record<string, string> = { updated_at: input.updated_at };
      if (input.comment !== undefined) {
        body['comment'] = input.comment;
      }
      return api.post<ApiResponse<ExpenseReportDetail>>(`/api/workflow/${input.id}/approve`, body);
    },
    onSuccess: (_data, variables) => {
      // state-management.md §ミューテーション後のキャッシュ無効化: useApproveReport
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'pending'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'payable'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
