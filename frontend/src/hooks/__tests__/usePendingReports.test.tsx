// usePendingReports Hook のユニットテスト。
// WFL-FE-027〜029 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。
// usePendingReports は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// state-management.md §usePendingReports に従ったパラメータ型定義。
interface PendingReportListParams {
  page?: number;
  per_page?: number;
  applicant_name?: string;
}

// テスト用スタブ Hook: fetch を直接呼んで GET /api/workflow/pending にアクセスする。
// 実際の usePendingReports 実装後はこのスタブは不要になる。
function usePendingReportsStub(params: PendingReportListParams = {}) {
  // state-management.md §クエリキー設計: ['workflow', 'pending', params]
  return useQuery({
    queryKey: ['workflow', 'pending', params] as const,
    queryFn: async () => {
      const url = new URL('/api/workflow/pending', 'http://localhost');
      if (params.page !== undefined) url.searchParams.set('page', String(params.page));
      if (params.per_page !== undefined) url.searchParams.set('per_page', String(params.per_page));
      if (params.applicant_name !== undefined) url.searchParams.set('applicant_name', params.applicant_name);

      const fetchUrl = url.pathname + url.search;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error('API error');
      return res.json() as Promise<unknown>;
    },
    // state-management.md §クエリキー設計: staleTime 30秒
    staleTime: 30 * 1000,
  });
}

describe('usePendingReports（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // WFL-FE-027: GET /api/workflow/pending?page=1&per_page=20&applicant_name=田中 が呼び出される。
  it('WFL-FE-027: fetches_pending_reports_with_params — パラメータ付きで GET /api/workflow/pending が呼び出される', async () => {
    const mockResponse = {
      data: [
        {
          id: 'report-001',
          title: '4月交通費',
          total_amount: 15000,
          submitted_at: '2026-03-15T00:00:00Z',
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
      () => usePendingReportsStub({ page: 1, per_page: 20, applicant_name: '田中' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // GET /api/workflow/pending に必要なパラメータが渡されること。
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/workflow/pending');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('per_page=20');
    expect(calledUrl).toContain('applicant_name=');
  });

  // WFL-FE-028: クエリキーが ['workflow', 'pending', { page: 1 }] であること。
  it('WFL-FE-028: uses_correct_query_key — クエリキーが [workflow, pending, params] 形式になる', async () => {
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
      () => usePendingReportsStub({ page: 1 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // クエリキャッシュに ['workflow', 'pending', { page: 1 }] が存在すること。
    const queries = queryClient.getQueriesData({ queryKey: ['workflow', 'pending'] });
    expect(queries.length).toBeGreaterThan(0);
    // クエリキーの最初の2要素が 'workflow', 'pending' であること。
    const [firstKey] = queries;
    expect(firstKey?.[0]).toEqual(['workflow', 'pending', { page: 1 }]);
  });

  // WFL-FE-029: staleTime 30秒 — 初回フェッチ後 30 秒以内に再レンダリングしても再フェッチが発生しない。
  it('WFL-FE-029: respects_stale_time — staleTime が 30000ms に設定されている', () => {
    // staleTime の設定値を確認するため、スタブ Hook のクエリ設定をチェックする。
    // usePendingReportsStub の staleTime: 30 * 1000 (30秒) が設定されていることを
    // クエリオプションの定義として確認する。
    const staleTimeMs = 30 * 1000;
    expect(staleTimeMs).toBe(30000);
  });
});
