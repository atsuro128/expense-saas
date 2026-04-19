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
 * useDeleteAttachment のオプション型。
 * useUploadAttachment と対称的なインターフェースとする（issue #108 FIX 2 §7-2 対等適用前提）。
 */
export interface UseDeleteAttachmentOptions {
  /**
   * 削除が中断されたときのコールバック。
   * Hook の unmount 時（明細切替）に AbortController が abort された場合に同期的に呼ばれる。
   * TanStack Query の onError は observer 破棄後に呼ばれないため、useEffect cleanup で直接呼ぶ（issue #108 §7-2）。
   */
  onAborted?: () => void;
}

/**
 * useDeleteAttachment は DELETE /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出すミューテーション Hook。
 * 成功後にレポート詳細のキャッシュを無効化して添付一覧を再取得する。
 * AbortController を組み込み、Hook の unmount 時（パネルクローズ相当）に進行中の fetch を中断する。
 *
 * AbortController は mutate() 呼び出し時に同期的に生成して ref に保存し、
 * mutationFn は ref 経由で signal を取得する。
 * これにより、mutate 直後の cancel() 呼び出しでも確実に abort() できる（TanStack Query の onMutate は非同期のため不使用）。
 *
 * unmount 時の中断通知（onAborted）は TanStack Query の onError を経由しない（unmount 後は observer が破棄されるため）。
 * useEffect cleanup で直接 onAborted を呼ぶことで、明細切替時でも確実に通知できる（issue #108 §7-2）。
 */
export function useDeleteAttachment(options?: UseDeleteAttachmentOptions) {
  const queryClient = useQueryClient();
  // 進行中の削除リクエストをキャンセルするための AbortController の参照。
  const abortControllerRef = useRef<AbortController | null>(null);
  // onAborted コールバックを ref に保持（最新版を常に参照するため）。
  const onAbortedRef = useRef(options?.onAborted);
  onAbortedRef.current = options?.onAborted;

  // Hook の unmount 時に進行中の削除を中断する。
  // アクティブな mutation がある場合（abortControllerRef.current != null）は onAborted を直接呼ぶ。
  // TanStack Query の onError は unmount 後に observer が破棄されるため呼ばれない（issue #108 §7-2）。
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        // onAborted を同期的に呼ぶ（TanStack Query の onError を経由しない）。
        onAbortedRef.current?.();
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

  /**
   * 明示的なキャンセル関数（パネルクローズ時などに呼び出す）。
   * cancel() を呼んだ場合、abortControllerRef.current は null になるため
   * unmount 時の onAborted は呼ばれない（二重通知を防ぐ）。
   * useUploadAttachment と同一パターン（issue #108 FIX 2 §7-2 対等適用）。
   */
  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // cancel() は明示的なキャンセル。onAborted は呼び出さない（呼び元が自分でトーストを表示する）。
    }
  };

  return { ...mutation, mutate, cancel };
}
