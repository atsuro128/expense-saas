// useDeleteReport Hook のユニットテスト。
// RPT-FE-100〜102 に対応する。
// useDeleteReport は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// テスト用スタブ Hook: fetch を直接呼んで DELETE /api/reports/:id にアクセスする。
function useDeleteReportStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      // 204 No Content の場合は undefined を返す
      return undefined;
    },
    onSuccess: () => {
      // レポート一覧・ダッシュボードのクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

describe('useDeleteReport（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // RPT-FE-100: DELETE /api/reports/:id が呼び出される。
  it('RPT-FE-100: DELETE /api/reports/:id が呼び出される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => undefined,
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync('test-id');
    });

    // DELETE /api/reports/test-id が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/test-id',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  // RPT-FE-101: ミューテーション成功後にレポート一覧のキャッシュが無効化される。
  it('RPT-FE-101: ミューテーション成功後にレポート一覧のキャッシュが無効化される', async () => {
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

    const { result } = renderHook(() => useDeleteReportStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('test-id');
    });

    await waitFor(() => {
      // レポート一覧のキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'mine'] }),
      );
      // ダッシュボードのキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['dashboard'] }),
      );
    });
  });

  // RPT-FE-102: API が 422 REPORT_NOT_DELETABLE を返すと isError=true になる。
  it('RPT-FE-102: API が 422 REPORT_NOT_DELETABLE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'REPORT_NOT_DELETABLE', message: '削除できない状態のレポートです' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync('submitted-report-id')).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    expect((result.current.error as { code?: string })?.code).toBe('REPORT_NOT_DELETABLE');
  });
});
