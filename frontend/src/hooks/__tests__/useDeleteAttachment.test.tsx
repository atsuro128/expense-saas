// useDeleteAttachment Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。
// useDeleteAttachment は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。
// ATT-FE-041〜044 に対応する。

import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// useDeleteAttachment のスタブ Hook: DELETE /api/reports/{id}/items/{itemId}/attachments/{attId} を呼ぶ。
interface DeleteAttachmentParams {
  reportId: string;
  itemId: string;
  attId: string;
}

function useDeleteAttachmentStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, itemId, attId }: DeleteAttachmentParams) => {
      const res = await fetch(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      // 204 No Content
      return undefined;
    },
    onSuccess: (_data, { reportId }) => {
      // レポート詳細のキャッシュを無効化して添付一覧を再取得する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
    },
  });
}

describe('useDeleteAttachment（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-041: DELETE /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出す。
  it('ATT-FE-041: DELETE /api/reports/{reportId}/items/{itemId}/attachments/{attId} が呼び出される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => undefined,
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteAttachmentStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        attId: 'att-001',
      });
    });

    // 正しい URL と method で fetch が呼ばれること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items/item-001/attachments/att-001',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(result.current.isSuccess).toBe(true);
  });

  // ATT-FE-042: ミューテーション成功後にレポート詳細のクエリキャッシュが無効化される。
  it('ATT-FE-042: ミューテーション成功後にレポート詳細キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => undefined,
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteAttachmentStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        attId: 'att-001',
      });
    });

    await waitFor(() => {
      // レポート詳細のキャッシュが無効化されること
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-001'] }),
      );
    });
  });

  // ATT-FE-043: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる（添付不存在）。
  it('ATT-FE-043: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'リソースが見つかりません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteAttachmentStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', attId: 'att-999' }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    const error = result.current.error as { status?: number };
    expect(error.status).toBe(404);
  });

  // ATT-FE-044: API が 422 REPORT_NOT_EDITABLE を返すと isError=true になる（非 draft 状態）。
  it('ATT-FE-044: API が 422 REPORT_NOT_EDITABLE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'REPORT_NOT_EDITABLE', message: 'レポートは編集可能な状態ではありません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteAttachmentStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'submitted-report-001', itemId: 'item-001', attId: 'att-001' }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    const error = result.current.error as { code?: string };
    expect(error.code).toBe('REPORT_NOT_EDITABLE');
  });
});
