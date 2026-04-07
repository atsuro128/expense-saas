// useAllReports Hook のユニットテスト。
// TNT-FE-035〜038 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import { useAllReports } from '../useAllReports';

// テスト用プロバイダーラッパー。
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

// API レスポンスモック。openapi.yaml ExpenseReportSummary に準拠した snake_case プロパティを使用する。
const mockReportsResponse = {
  data: [
    {
      id: 'rpt-001',
      title: '出張費',
      submitter: { id: 'u1', name: 'User1' },
      total_amount: 10000,
      status: 'submitted',
      submitted_at: '2025-01-15T00:00:00Z',
      created_at: '2025-01-10T00:00:00Z',
    },
  ],
  pagination: {
    current_page: 1,
    per_page: 20,
    total_count: 1,
    total_pages: 1,
  },
};

describe('useAllReports', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockReportsResponse,
    } as unknown as Response);
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // TNT-FE-035: デフォルトパラメータ（page=1）で API が呼ばれること。
  it('TNT-FE-035: パラメータ指定なしで呼び出すと GET /api/reports/all に page=1 で API が呼ばれる', async () => {
    const { result } = renderHook(() => useAllReports(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // data.data がレポート配列であること。
    expect(result.current.data?.data).toBeInstanceOf(Array);

    // API が page=1 で呼び出されること。
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('page=1');
  });

  // TNT-FE-036: フィルタパラメータが API に渡されること。
  it('TNT-FE-036: フィルタパラメータを指定すると対応するクエリパラメータ付きで API が呼ばれる', async () => {
    const { result } = renderHook(
      () =>
        useAllReports({
          status: 'submitted',
          from: '2025-01-01',
          to: '2025-01-31',
          submitter_id: 'u1',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;

    // 各クエリパラメータが含まれること。
    expect(calledUrl).toContain('status=submitted');
    expect(calledUrl).toContain('from=2025-01-01');
    expect(calledUrl).toContain('to=2025-01-31');
    expect(calledUrl).toContain('submitter_id=u1');
  });

  // TNT-FE-037: ページネーションパラメータが API に渡されること。
  it('TNT-FE-037: page=3&per_page=20 を指定すると対応するクエリパラメータ付きで API が呼ばれる', async () => {
    const { result } = renderHook(
      () => useAllReports({ page: 3, per_page: 20 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;

    expect(calledUrl).toContain('page=3');
    expect(calledUrl).toContain('per_page=20');
  });

  // TNT-FE-038: API エラー時に error が非 null であること。
  it('TNT-FE-038: GET /api/reports/all が 500 を返したとき error が非 null で isError が true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useAllReports(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.isError).toBe(true);
  });
});
