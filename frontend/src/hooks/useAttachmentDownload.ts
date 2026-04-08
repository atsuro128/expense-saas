// useAttachmentDownload Hook: GET /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出して
// 添付ファイルの署名付きダウンロード URL を取得する。
// 署名付き URL は有効期限15分のため staleTime=0 で毎回取得する。
// 対応テストケース: ATT-FE-033〜035

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AttachmentDownload } from '../api/types';

/** useAttachmentDownload のパラメータ。 */
export interface UseAttachmentDownloadParams {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
  /** 添付ファイル ID。 */
  attId: string;
}

/**
 * useAttachmentDownload は GET /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出すクエリ Hook。
 * S3 署名付きダウンロード URL を含むレスポンスを返す。
 * 署名付き URL は有効期限15分のため、staleTime=0 で毎回サーバーから取得する。
 */
export function useAttachmentDownload({ reportId, itemId, attId }: UseAttachmentDownloadParams) {
  return useQuery({
    queryKey: ['reports', reportId, 'items', itemId, 'attachments', attId],
    queryFn: async () => {
      return api.get<ApiResponse<AttachmentDownload>>(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}`,
      );
    },
    staleTime: 0,
  });
}
