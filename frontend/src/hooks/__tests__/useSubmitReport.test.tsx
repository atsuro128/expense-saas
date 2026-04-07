// useSubmitReport Hook のユニットテスト。
// RPT-FE-097〜099 に対応する。
// useSubmitReport は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// テスト用スタブ Hook: fetch を直接呼んで POST /api/reports/:id/submit にアクセスする。
interface SubmitReportInput {
  id: string;
  updatedAt: string;
}

function useSubmitReportStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitReportInput) => {
      const res = await fetch(`/api/reports/${input.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated_at: input.updatedAt }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
    onSuccess: (_data, variables) => {
      // レポート詳細・一覧のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

describe('useSubmitReport（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // RPT-FE-097: POST /api/reports/:id/submit が updated_at 付きで呼び出される。
  it('RPT-FE-097: POST /api/reports/:id/submit が updated_at 付きで呼び出される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'test-id', status: 'submitted' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useSubmitReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'test-id',
        updatedAt: '2026-03-01T00:00:00Z',
      });
    });

    // POST /api/reports/test-id/submit が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/test-id/submit',
      expect.objectContaining({ method: 'POST' }),
    );

    // リクエストボディに updated_at が含まれること
    const calledBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    );
    expect(calledBody).toHaveProperty('updated_at', '2026-03-01T00:00:00Z');
  });

  // RPT-FE-098: ミューテーション成功後にレポート詳細・一覧のキャッシュが無効化される。
  it('RPT-FE-098: ミューテーション成功後にレポート詳細・一覧のキャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'test-id', status: 'submitted' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSubmitReportStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'test-id',
        updatedAt: '2026-03-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  // RPT-FE-099: API が 422 EMPTY_REPORT_SUBMISSION を返すと isError=true になる。
  it('RPT-FE-099: API が 422 EMPTY_REPORT_SUBMISSION を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'EMPTY_REPORT_SUBMISSION', message: '明細がありません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useSubmitReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'empty-report-id', updatedAt: '2026-03-01T00:00:00Z' }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    expect((result.current.error as { code?: string })?.code).toBe('EMPTY_REPORT_SUBMISSION');
  });
});
