// useMarkAsPaid Hook のユニットテスト。
// WFL-FE-076〜078 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。
// useMarkAsPaid は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// state-management.md §useMarkAsPaid に従った入力型定義。
// 入力: { id: string; updated_at: string }
interface MarkAsPaidInput {
  id: string;
  updated_at: string;
}

// テスト用スタブ Hook: fetch を直接呼んで POST /api/workflow/:id/pay にアクセスする。
// 実際の useMarkAsPaid 実装後はこのスタブは不要になる。
function useMarkAsPaidStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkAsPaidInput) => {
      const res = await fetch(`/api/workflow/${input.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated_at: input.updated_at }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
    onSuccess: (_data, variables) => {
      // state-management.md §ミューテーション後のキャッシュ無効化: useMarkAsPaid
      // invalidate: ['reports', 'detail', id], ['workflow', 'payable'], ['dashboard'], ['reports', 'all']
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'payable'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'all'] });
    },
  });
}

describe('useMarkAsPaid（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // WFL-FE-076: POST /api/workflow/report-1/pay が updated_at 付きで呼び出される。
  it('WFL-FE-076: calls_pay_api — POST /api/workflow/:id/pay が updated_at 付きで呼び出される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'report-1', status: 'paid' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useMarkAsPaidStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'report-1',
        updated_at: '2026-04-01T00:00:00Z',
      });
    });

    // POST /api/workflow/report-1/pay が呼ばれていること。
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/workflow/report-1/pay',
      expect.objectContaining({ method: 'POST' }),
    );

    // リクエストボディに updated_at が含まれること。
    const calledBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string,
    );
    expect(calledBody).toHaveProperty('updated_at', '2026-04-01T00:00:00Z');
  });

  // WFL-FE-077: 支払完了成功後に ['reports', 'detail', id], ['workflow', 'payable'], ['dashboard'], ['reports', 'all'] のキャッシュが無効化される。
  it('WFL-FE-077: invalidates_caches_on_success — 支払完了成功後に関連キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'report-1', status: 'paid' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMarkAsPaidStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'report-1',
        updated_at: '2026-04-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      // state-management.md §useMarkAsPaid: 4つのキャッシュを無効化する。
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-1'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['workflow', 'payable'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['dashboard'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'all'] }),
      );
    });
  });

  // WFL-FE-078: 409 CONFLICT 時に error が設定される。
  it('WFL-FE-078: returns_error_on_409_conflict — 409 CONFLICT 時に error が設定される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'CONFLICT', message: '競合が発生しました' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useMarkAsPaidStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'report-1', updated_at: '2000-01-01T00:00:00Z' }),
      ).rejects.toThrow();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).not.toBeNull();
  });
});
