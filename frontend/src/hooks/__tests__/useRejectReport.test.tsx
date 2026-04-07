// useRejectReport Hook のユニットテスト。
// WFL-FE-073〜075 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { useRejectReport } from '../useRejectReport';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRejectReport', () => {
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

    const { result } = renderHook(() => useRejectReport(), { wrapper: createWrapper() });

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

    const { result } = renderHook(() => useRejectReport(), { wrapper });

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

  // WFL-FE-075: 409 CONFLICT 時に error が設定され、キャッシュは無効化されない。
  it('WFL-FE-075: returns_error_on_409_conflict — 409 CONFLICT 時に error が設定され invalidateQueries は呼ばれない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'CONFLICT', message: '競合が発生しました' } }),
    } as unknown as Response);

    // invalidateQueries が呼ばれないことを spy で確認するため独自 QueryClient を使う。
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRejectReport(), { wrapper });

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
    // 409 エラー時はキャッシュが無効化されないこと。
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
