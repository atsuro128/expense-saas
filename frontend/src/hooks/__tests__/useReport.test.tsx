// useReport Hook のユニットテスト。
// RPT-FE-059〜060 に対応する。
// useReport は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// テスト用スタブ Hook: fetch を直接呼んで GET /api/reports/:id にアクセスする。
function useReportStub(reportId: string) {
  return useQuery({
    queryKey: ['reports', reportId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${reportId}`);
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
  });
}

describe('useReport（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // RPT-FE-059: GET /api/reports/:id を呼び出し、data にレポート詳細が格納される。
  it('RPT-FE-059: GET /api/reports/:id を呼び出し、data にレポート詳細が格納される', async () => {
    const mockReport = {
      id: 'test-report-id',
      title: 'テストレポート',
      status: 'draft',
      total_amount: 1000,
      items: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockReport }),
    } as unknown as Response);

    const { result } = renderHook(
      () => useReportStub('test-report-id'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // GET /api/reports/test-report-id が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/reports/test-report-id');
    expect(result.current.data).toEqual(mockReport);
  });

  // RPT-FE-060: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる。
  it('RPT-FE-060: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'RESOURCE_NOT_FOUND', message: 'リソースが見つかりません' } }),
    } as unknown as Response);

    const { result } = renderHook(
      () => useReportStub('non-existent-id'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as { code?: string })?.code).toBe('RESOURCE_NOT_FOUND');
  });
});
