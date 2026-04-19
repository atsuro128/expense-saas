// useUploadAttachment Hook: POST /api/reports/{reportId}/items/{itemId}/attachments を呼び出して添付ファイルをアップロードする。
// multipart/form-data で送信する。
// 対応テストケース: ATT-FE-036〜040, ATT-FE-059

import { useEffect, useRef } from 'react';
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

/** useUploadAttachment のオプション型。 */
export interface UseUploadAttachmentOptions {
  /**
   * アップロードが中断されたときのコールバック。
   * Hook の unmount 時（明細切替）に AbortController が abort された場合に同期的に呼ばれる。
   * TanStack Query の onError は observer 破棄後に呼ばれないため、useEffect cleanup で直接呼ぶ（issue #108 §7-2）。
   */
  onAborted?: () => void;
}

/**
 * useUploadAttachment は POST /api/reports/{reportId}/items/{itemId}/attachments を呼び出すミューテーション Hook。
 * multipart/form-data でファイルを送信し、成功後にレポート詳細のキャッシュを無効化する。
 * AbortController を組み込み、Hook の unmount 時（パネルクローズ相当）に進行中の fetch を中断する。
 *
 * AbortController は mutate() 呼び出し時に同期的に生成して ref に保存し、
 * mutationFn は ref 経由で signal を取得する。
 * これにより、mutate 直後の cancel() 呼び出しでも確実に abort() できる（TanStack Query の onMutate は非同期のため不使用）。
 *
 * unmount 時の中断通知（onAborted）は TanStack Query の onError を経由しない（unmount 後は observer が破棄されるため）。
 * useEffect cleanup で直接 onAborted を呼ぶことで、明細切替時でも確実に通知できる（issue #108 §7-2）。
 */
export function useUploadAttachment(options?: UseUploadAttachmentOptions) {
  const queryClient = useQueryClient();
  // 進行中のアップロードリクエストをキャンセルするための AbortController の参照。
  const abortControllerRef = useRef<AbortController | null>(null);
  // onAborted コールバックを ref に保持（最新版を常に参照するため）。
  const onAbortedRef = useRef(options?.onAborted);
  onAbortedRef.current = options?.onAborted;

  // Hook の unmount 時に進行中のアップロードを中断する。
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
    mutationFn: async ({ reportId, itemId, file }: UploadAttachmentParams) => {
      // mutate() ラッパーで同期的に設定された AbortController の signal を取得する。
      const signal = abortControllerRef.current?.signal;

      const formData = new FormData();
      formData.append('file', file);

      return api.post<ApiResponse<Attachment>>(
        `/api/reports/${reportId}/items/${itemId}/attachments`,
        formData,
        signal,
      );
    },
    onSuccess: (_data, { reportId, itemId }) => {
      // レポート詳細のキャッシュを無効化して添付一覧を再取得する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
      // 添付一覧キャッシュを無効化して再取得する。
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
    params: UploadAttachmentParams,
    options?: Parameters<typeof mutation.mutate>[1],
  ) => {
    // 前の AbortController を中断してから新しいものを生成する（重複呼び出し対策）。
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // AbortController を同期的に生成して ref に保存する。
    // mutationFn は非同期で実行されるが、ref 経由で signal を取得できる。
    abortControllerRef.current = new AbortController();

    // TanStack Query の mutate を呼び出す（params の型は公開型 UploadAttachmentParams）。
    mutation.mutate(params, options);
  };

  /**
   * 明示的なキャンセル関数（パネルクローズ時などに呼び出す）。
   * cancel() を呼んだ場合、abortControllerRef.current は null になるため
   * unmount 時の onAborted は呼ばれない（二重通知を防ぐ）。
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
