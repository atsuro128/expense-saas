// useDeleteAttachment Hook: DELETE /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出して
// 添付ファイルを削除する。
// 対応テストケース: ATT-FE-041〜044

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

/** useDeleteAttachment のミューテーション入力型。 */
export interface DeleteAttachmentParams {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
  /** 添付ファイル ID。 */
  attId: string;
}

/**
 * useDeleteAttachment は DELETE /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出すミューテーション Hook。
 * 成功後にレポート詳細のキャッシュを無効化して添付一覧を再取得する。
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, itemId, attId }: DeleteAttachmentParams) => {
      return api.delete<void>(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}`,
      );
    },
    onSuccess: (_data, { reportId }) => {
      // レポート詳細のキャッシュを無効化して添付一覧を再取得する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
    },
  });
}
