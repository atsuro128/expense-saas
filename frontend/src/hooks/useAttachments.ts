// useAttachments Hook: GET /api/reports/{reportId}/items/{itemId}/attachments を呼び出して添付ファイル一覧を取得する。
// 対応テストケース: ATT-FE-029〜032

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, Attachment } from '../api/types';

/** useAttachments のパラメータ。 */
export interface UseAttachmentsParams {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
}

/**
 * useAttachments は GET /api/reports/{reportId}/items/{itemId}/attachments を呼び出すクエリ Hook。
 * 指定した明細に紐づく添付ファイル一覧を返す。
 */
export function useAttachments({ reportId, itemId }: UseAttachmentsParams) {
  return useQuery({
    queryKey: ['reports', reportId, 'items', itemId, 'attachments'],
    queryFn: async () => {
      return api.get<ApiResponse<Attachment[]>>(
        `/api/reports/${reportId}/items/${itemId}/attachments`,
      );
    },
  });
}
