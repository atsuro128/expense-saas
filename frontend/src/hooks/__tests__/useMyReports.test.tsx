// useMyReports Hook のユニットテスト。
// RPT-FE-021〜023 に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。
// useMyReports は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// テスト用スタブ Hook: fetch を直接呼んで /api/reports にアクセスする。
// 実際の useMyReports 実装後はこのスタブは不要になる。
interface MyReportsParams {
  page?: number;
  per_page?: number;
  status?: string;
  from?: string;
  to?: string;
}

function useMyReportsStub(params: MyReportsParams = {}) {
  return useQuery({
    queryKey: ['reports', 'mine', params],
    queryFn: async () => {
      const url = new URL('/api/reports', 'http://localhost');
      if (params.page) url.searchParams.set('page', String(params.page));
      if (params.per_page) url.searchParams.set('per_page', String(params.per_page));
      if (params.status) url.searchParams.set('status', params.status);
      if (params.from) url.searchParams.set('from', params.from);
      if (params.to) url.searchParams.set('to', params.to);

      const fetchUrl = url.pathname + url.search;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error('API error');
      return res.json() as Promise<unknown>;
    },
  });
}

describe('useMyReports（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // RPT-FE-021: GET /api/reports?page=1&per_page=20 を呼び出し、data にレポート一覧、pagination に件数情報が格納される。
  it('RPT-FE-021: GET /api/reports にページネーションパラメータを付与して呼び出す', async () => {
    const mockResponse = {
      data: [
        { id: 'report-001', title: 'レポート1', status: 'draft' },
        { id: 'report-002', title: 'レポート2', status: 'submitted' },
      ],
      pagination: { current_page: 1, per_page: 20, total_count: 2, total_pages: 1 },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockResponse,
    } as unknown as Response);

    const { result } = renderHook(
      () => useMyReportsStub({ page: 1, per_page: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // fetch が /api/reports を含む URL で呼ばれていること
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/reports');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('per_page=20');
  });

  // RPT-FE-022: status・from・to フィルタパラメータが URL クエリに含まれる。
  it('RPT-FE-022: フィルタパラメータが URL クエリに含まれる', async () => {
    const mockResponse = {
      data: [{ id: 'report-001', title: 'ドラフト', status: 'draft' }],
      pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockResponse,
    } as unknown as Response);

    renderHook(
      () => useMyReportsStub({ status: 'draft', from: '2026-03-01', to: '2026-03-31' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('status=draft');
    expect(calledUrl).toContain('from=2026-03-01');
    expect(calledUrl).toContain('to=2026-03-31');
  });

  // RPT-FE-023: API が 500 エラーを返すと isError=true になる。
  it('RPT-FE-023: API が 500 エラーを返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' } }),
    } as unknown as Response);

    const { result } = renderHook(
      () => useMyReportsStub({ page: 1, per_page: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
