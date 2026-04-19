// useDeleteAttachment Hook: DELETE /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出して
// 添付ファイルを削除する。
// 対応テストケース: ATT-FE-041〜044, ATT-FE-061

import { useEffect, useRef } from 'react';
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
 * AbortController を組み込み、Hook の unmount 時（パネルクローズ相当）に進行中の fetch を中断する。
 *
 * AbortController は mutate() 呼び出し時に同期的に生成して ref に保存し、
 * mutationFn は ref 経由で signal を取得する。
 * これにより、mutate 直後の cancel() 呼び出しでも確実に abort() できる（TanStack Query の onMutate は非同期のため不使用）。
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  // 進行中の削除リクエストをキャンセルするための AbortController の参照。
  const abortControllerRef = useRef<AbortController | null>(null);

  // Hook の unmount 時に進行中の削除を中断する。
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async ({ reportId, itemId, attId }: DeleteAttachmentParams) => {
      // mutate() ラッパーで同期的に設定された AbortController の signal を取得する。
      const signal = abortControllerRef.current?.signal;

      return api.delete<void>(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}`,
        signal,
      );
    },
    onSuccess: (_data, { reportId, itemId }) => {
      // レポート詳細のキャッシュを無効化する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
      // 添付一覧キャッシュを無効化して再取得する（useUploadAttachment と同一パターン）。
      void queryClient.invalidateQueries({
        queryKey: ['reports', reportId, 'items', itemId, 'attachments'],
      });
    },
  });

  /**
   * mutate のラッパー。TanStack Query の mutate() 呼び出し前に AbortController を同期的に生成して ref に保存する。
   * TanStack Query の onMutate は非同期実行されるため、cancel() のタイミングと競合する可能性がある。
   * ラッパーで同期的に生成することで、mutate 直後の cancel() 呼び出しでも確実に abort() できる。
   */
  const mutate = (
    params: DeleteAttachmentParams,
    options?: Parameters<typeof mutation.mutate>[1],
  ) => {
    // 前の AbortController を中断してから新しいものを生成する（重複呼び出し対策）。
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // AbortController を同期的に生成して ref に保存する。
    // mutationFn は非同期で実行されるが、ref 経由で signal を取得できる。
    abortControllerRef.current = new AbortController();

    // TanStack Query の mutate を呼び出す（params の型は公開型 DeleteAttachmentParams）。
    mutation.mutate(params, options);
  };

  // 明示的なキャンセル関数（パネルクローズ時などに呼び出す）。
  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return { ...mutation, mutate, cancel };
}
