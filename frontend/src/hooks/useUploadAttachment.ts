// useUploadAttachment Hook: POST /api/reports/{reportId}/items/{itemId}/attachments を呼び出して添付ファイルをアップロードする。
// multipart/form-data で送信する。
// 対応テストケース: ATT-FE-036〜040

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, Attachment } from '../api/types';

/** useUploadAttachment のミューテーション入力型。 */
export interface UploadAttachmentParams {
  /** レポート ID。 */
  reportId: string;
  /** 明細 ID。 */
  itemId: string;
  /** アップロードするファイル。 */
  file: File;
}

/**
 * useUploadAttachment は POST /api/reports/{reportId}/items/{itemId}/attachments を呼び出すミューテーション Hook。
 * multipart/form-data でファイルを送信し、成功後にレポート詳細のキャッシュを無効化する。
 */
export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, itemId, file }: UploadAttachmentParams) => {
      const formData = new FormData();
      formData.append('file', file);

      return api.post<ApiResponse<Attachment>>(
        `/api/reports/${reportId}/items/${itemId}/attachments`,
        formData,
      );
    },
    onSuccess: (_data, { reportId }) => {
      // レポート詳細のキャッシュを無効化して添付一覧を再取得する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
    },
  });
}
