// useAttachmentPreviewUrl Hook:
// GET /api/reports/{reportId}/items/{itemId}/attachments/{attId}/preview を呼び出して
// 添付ファイルの署名付きプレビュー URL を取得する。
// 署名付き URL は有効期限15分のため、クリック時のみ取得する（enabled: false + 明示的 refetch）。
// 対応テストケース: ATT-FE-049b 周辺

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AttachmentAccess } from '../api/types';

/** useAttachmentPreviewUrl のパラメータ。 */
export interface UseAttachmentPreviewUrlParams {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
  /** 添付ファイル ID。 */
  attId: string;
}

/**
 * useAttachmentPreviewUrl は GET /api/reports/{reportId}/items/{itemId}/attachments/{attId}/preview
 * を呼び出すクエリ Hook。
 * S3 署名付きプレビュー URL（Content-Disposition: inline）を含むレスポンスを返す。
 * 初期ロードは不要（enabled: false）で、クリック時に明示的に refetch() を呼ぶ方式を採用する。
 * useAttachmentDownloadUrl と完全に mirror な構造で、URL のみ異なる。
 */
export function useAttachmentPreviewUrl({
  reportId,
  itemId,
  attId,
}: UseAttachmentPreviewUrlParams) {
  return useQuery({
    queryKey: ['reports', reportId, 'items', itemId, 'attachments', attId, 'preview'],
    queryFn: async () => {
      return api.get<ApiResponse<AttachmentAccess>>(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}/preview`,
      );
    },
    // クリック時のみ取得するため初期フェッチを無効にする。
    enabled: false,
    // 署名付き URL は毎回取得する必要があるため staleTime=0 とする。
    staleTime: 0,
  });
}
