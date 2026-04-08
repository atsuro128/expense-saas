// useAttachmentDownload Hook: GET /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出して
// 添付ファイルの署名付きダウンロード URL を取得する。
// 署名付き URL はリクエストのたびに新たに生成されるため、ミューテーション型で実装する。
// 対応テストケース: ATT-FE-033〜035

import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, AttachmentDownload } from '../api/types';

/** useAttachmentDownload のミューテーション入力型。 */
export interface AttachmentDownloadParams {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
  /** 添付ファイル ID。 */
  attId: string;
}

/**
 * useAttachmentDownload は GET /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出すミューテーション Hook。
 * S3 署名付きダウンロード URL を含むレスポンスを返す。
 * 署名付き URL は呼び出しのたびに生成されるため、キャッシュは使用しない。
 */
export function useAttachmentDownload() {
  return useMutation({
    mutationFn: async ({ reportId, itemId, attId }: AttachmentDownloadParams) => {
      return api.get<ApiResponse<AttachmentDownload>>(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}`,
      );
    },
    // ダウンロード URL 取得は読み取り専用操作のためキャッシュ無効化不要。
  });
}
