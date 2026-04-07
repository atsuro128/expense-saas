// usePayableReports Hook のユニットテスト。
// WFL-FE-052〜054 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { usePayableReports } from '../useReports';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('usePayableReports', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // WFL-FE-052: GET /api/workflow/payable?page=1&per_page=20&applicant_name=田中 が呼び出される。
  it('WFL-FE-052: fetches_payable_reports_with_params — パラメータ付きで GET /api/workflow/payable が呼び出される', async () => {
    const mockResponse = {
      data: [
        {
          id: 'report-001',
          title: '4月交通費',
          total_amount: 15000,
          approved_at: '2026-03-20T00:00:00Z',
          submitter: { id: 'user-001', name: '田中太郎' },
          is_own_report: false,
        },
      ],
      pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockResponse,
    } as unknown as Response);

    const { result } = renderHook(
      () => usePayableReports({ page: 1, per_page: 20, applicant_name: '田中' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // GET /api/workflow/payable に必要なパラメータが渡されること。
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/workflow/payable');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('per_page=20');
    expect(calledUrl).toContain('applicant_name=');
  });

  // WFL-FE-053: クエリキーが ['workflow', 'payable', { page: 1 }] であること。
  it('WFL-FE-053: uses_correct_query_key — クエリキーが [workflow, payable, params] 形式になる', async () => {
    const mockResponse = {
      data: [],
      pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockResponse,
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => usePayableReports({ page: 1 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // クエリキャッシュに ['workflow', 'payable', { page: 1 }] が存在すること。
    const queries = queryClient.getQueriesData({ queryKey: ['workflow', 'payable'] });
    expect(queries.length).toBeGreaterThan(0);
    const [firstKey] = queries;
    expect(firstKey?.[0]).toEqual(['workflow', 'payable', { page: 1 }]);
  });

  // WFL-FE-054: staleTime 30秒 — 初回フェッチ後 30 秒以内に再レンダリングしても再フェッチが発生しない。
  it('WFL-FE-054: respects_stale_time — staleTime 30秒以内は再 fetch しない', async () => {
    // 同一 QueryClient を使ってキャッシュを共有する。
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // 1回目の fetch をモック。
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
    } as unknown as Response);
    globalThis.fetch = fetchSpy;

    // Hook をレンダリング → 最初の fetch が発生する。
    const { result, unmount } = renderHook(() => usePayableReports({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // 初回 fetch が 1 回呼ばれていること。
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // アンマウント後に同じ QueryClient で再レンダリングする（staleTime 内）。
    unmount();
    renderHook(() => usePayableReports({}), { wrapper });

    // staleTime 以内なので fetch は再度呼ばれない。
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
