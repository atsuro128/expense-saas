// useUpdateReport Hook のユニットテスト。
// RPT-FE-061〜063 に対応する。
// useUpdateReport は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// テスト用スタブ Hook: fetch を直接呼んで PUT /api/reports/:id にアクセスする。
interface UpdateReportInput {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  updated_at: string;
}

function useUpdateReportStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateReportInput) => {
      const body = {
        title: input.title,
        period_start: input.period_start,
        period_end: input.period_end,
        updated_at: input.updated_at,
      };

      const res = await fetch(`/api/reports/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
    onSuccess: (_data, variables) => {
      // レポート詳細・一覧・ダッシュボードのクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

describe('useUpdateReport（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // RPT-FE-061: PUT /api/reports/:id のリクエストボディに updated_at が含まれる。
  it('RPT-FE-061: PUT /api/reports/:id のリクエストボディに updated_at が含まれる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'test-id', title: '更新', status: 'draft' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useUpdateReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'test-id',
        title: '更新',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        updated_at: '2026-03-01T00:00:00Z',
      });
    });

    // PUT /api/reports/test-id が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/test-id',
      expect.objectContaining({ method: 'PUT' }),
    );

    // リクエストボディに updated_at が含まれること
    const calledBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string,
    );
    expect(calledBody).toHaveProperty('updated_at', '2026-03-01T00:00:00Z');
  });

  // RPT-FE-062: ミューテーション成功後にレポート詳細・一覧のキャッシュが無効化される。
  it('RPT-FE-062: ミューテーション成功後にレポート詳細・一覧のキャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'test-id', title: '更新', status: 'draft' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateReportStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'test-id',
        title: '更新',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        updated_at: '2026-03-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      // 更新成功後にキャッシュが無効化されること（state-management.md §useUpdateReport 準拠）
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'test-id'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'mine'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['dashboard'] }),
      );
    });
  });

  // RPT-FE-063: API が 409 CONFLICT を返すと isError=true になる。
  it('RPT-FE-063: API が 409 CONFLICT を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'CONFLICT', message: '競合が発生しました' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUpdateReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'test-id',
          title: '更新',
          period_start: '2026-03-01',
          period_end: '2026-03-31',
          updated_at: '2020-01-01T00:00:00Z', // 古い値
        }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    expect((result.current.error as { code?: string })?.code).toBe('CONFLICT');
  });
});
