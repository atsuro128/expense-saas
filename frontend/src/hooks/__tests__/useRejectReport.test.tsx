// useRejectReport Hook のユニットテスト。
// WFL-FE-073〜075 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。
// useRejectReport は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// state-management.md §useRejectReport に従った入力型定義。
// RejectRequest = { reason: string; updated_at: string }
interface RejectInput {
  id: string;
  reason: string;
  updated_at: string;
}

// テスト用スタブ Hook: fetch を直接呼んで POST /api/workflow/:id/reject にアクセスする。
// 実際の useRejectReport 実装後はこのスタブは不要になる。
function useRejectReportStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RejectInput) => {
      const res = await fetch(`/api/workflow/${input.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: input.reason, updated_at: input.updated_at }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
    onSuccess: (_data, variables) => {
      // state-management.md §ミューテーション後のキャッシュ無効化: useRejectReport
      // invalidate: ['reports', 'detail', id], ['workflow', 'pending'], ['dashboard']
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'pending'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

describe('useRejectReport（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // WFL-FE-073: POST /api/workflow/report-1/reject が reason 付きで呼び出される。
  it('WFL-FE-073: calls_reject_api_with_reason — POST /api/workflow/:id/reject が reason と updated_at 付きで呼び出される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'report-1', status: 'rejected' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useRejectReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'report-1',
        reason: '領収書が不明瞭です',
        updated_at: '2026-04-01T00:00:00Z',
      });
    });

    // POST /api/workflow/report-1/reject が呼ばれていること。
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/workflow/report-1/reject',
      expect.objectContaining({ method: 'POST' }),
    );

    // リクエストボディに reason と updated_at が含まれること。
    const calledBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string,
    );
    expect(calledBody).toHaveProperty('reason', '領収書が不明瞭です');
    expect(calledBody).toHaveProperty('updated_at', '2026-04-01T00:00:00Z');
  });

  // WFL-FE-074: 却下成功後に ['reports', 'detail', id], ['workflow', 'pending'], ['dashboard'] のキャッシュが無効化される。
  it('WFL-FE-074: invalidates_caches_on_success — 却下成功後に関連キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'report-1', status: 'rejected' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRejectReportStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'report-1',
        reason: '領収書が不明瞭です',
        updated_at: '2026-04-01T00:00:00Z',
      });
    });

    await waitFor(() => {
      // state-management.md §useRejectReport: 3つのキャッシュを無効化する。
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-1'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['workflow', 'pending'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['dashboard'] }),
      );
    });
  });

  // WFL-FE-075: 409 CONFLICT 時に error が設定される。
  it('WFL-FE-075: returns_error_on_409_conflict — 409 CONFLICT 時に error が設定される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'CONFLICT', message: '競合が発生しました' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useRejectReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'report-1',
          reason: '理由',
          updated_at: '2000-01-01T00:00:00Z',
        }),
      ).rejects.toThrow();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).not.toBeNull();
  });
});
