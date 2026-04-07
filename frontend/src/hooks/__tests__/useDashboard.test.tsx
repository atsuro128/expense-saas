// useDashboard Hook のユニットテスト。
// DSH-FE-034〜DSH-FE-036 に対応する。
// MSW 未インストールのため fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDashboard } from '../useDashboard';
import * as authStore from '../../stores/auth';

/** テスト用 QueryClient ラッパーを生成する。 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDashboard', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('test-token');
    vi.spyOn(authStore, 'getRefreshToken').mockReturnValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // DSH-FE-034: GET /api/dashboard が 200 を返したとき data が格納され、isLoading が false になること。
  it('DSH-FE-034: GET /api/dashboard が成功したとき data に DashboardResponse が格納される', async () => {
    const mockData = {
      my_draft_count: 2,
      my_submitted_count: 1,
      my_rejected_count: 0,
      recent_reports: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockData }),
    } as unknown as Response);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ data: mockData });
    expect(result.current.error).toBeNull();
  });

  // DSH-FE-035: GET /api/dashboard が 500 を返したとき error が設定され、data が undefined になること。
  it('DSH-FE-035: GET /api/dashboard が 500 を返したとき error が設定される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  // DSH-FE-036: 60 秒以内に 2 回呼び出したとき API 呼び出しが 1 回のみ発生すること（staleTime キャッシュ）。
  it('DSH-FE-036: 60 秒以内の連続呼び出しで API が 1 回のみ呼ばれる（staleTime キャッシュ）', async () => {
    const mockData = { my_draft_count: 1 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockData }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    // staleTime: 60秒 で QueryClient を作成する。
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // 1 回目のレンダリング。
    const { result: result1 } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result1.current.isLoading).toBe(false));

    // 2 回目のレンダリング（同じ QueryClient を使用するため staleTime 内ならキャッシュが使われる）。
    const { result: result2 } = renderHook(() => useDashboard(), { wrapper });
    await waitFor(() => expect(result2.current.isLoading).toBe(false));

    // fetch が 1 回のみ呼ばれること。
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
