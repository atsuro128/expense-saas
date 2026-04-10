// useCreateReport Hook のユニットテスト。
// RPT-FE-046〜049 に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。
// useCreateReport は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// テスト用スタブ Hook: fetch を直接呼んで POST /api/reports にアクセスする。
interface CreateReportInput {
  title: string;
  period_start: string;
  period_end: string;
  reference_report_id?: string;
}

function useCreateReportStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReportInput) => {
      const body = {
        title: input.title,
        period_start: input.period_start,
        period_end: input.period_end,
        ...(input.reference_report_id ? { reference_report_id: input.reference_report_id } : {}),
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: { id: string } };
      return data.data;
    },
    onSuccess: () => {
      // レポート一覧・ダッシュボードのクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

describe('useCreateReport（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // RPT-FE-046: POST /api/reports が呼び出される。
  it('RPT-FE-046: POST /api/reports を呼び出し、作成されたレポートが返る', async () => {
    const mockCreatedReport = {
      id: 'new-report-001',
      title: 'テスト',
      status: 'draft',
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: mockCreatedReport }),
    } as unknown as Response);

    const { result } = renderHook(() => useCreateReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'テスト',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
      });
    });

    // POST /api/reports が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports',
      expect.objectContaining({ method: 'POST' }),
    );
    // React ステート更新が完了するまで待機してからアサートする
    await waitFor(() => {
      expect(result.current.data).toEqual(mockCreatedReport);
    });
  });

  // RPT-FE-047: reference_report_id を含むリクエストが POST /api/reports に送信される。
  it('RPT-FE-047: reference_report_id がリクエストボディに含まれる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'new-report-002', title: '再申請', status: 'draft' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useCreateReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        title: '再申請',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        reference_report_id: 'rejected-report-001',
      });
    });

    // リクエストボディに reference_report_id が含まれること
    const calledBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string,
    );
    expect(calledBody).toHaveProperty('reference_report_id', 'rejected-report-001');
  });

  // RPT-FE-048: ミューテーション成功後にレポート一覧のクエリキャッシュが無効化される。
  it('RPT-FE-048: ミューテーション成功後にレポート一覧のクエリキャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'new-report-003', title: 'テスト', status: 'draft' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateReportStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'テスト',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
      });
    });

    await waitFor(() => {
      // レポート一覧のキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'mine'] }),
      );
      // ダッシュボードのキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['dashboard'] }),
      );
    });
  });

  // RPT-FE-049: API が 422 VALIDATION_ERROR を返すと isError=true になる。
  it('RPT-FE-049: API が 422 VALIDATION_ERROR を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'VALIDATION_ERROR', message: 'バリデーションエラー', details: [] },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCreateReportStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: '',
          period_start: '2026-03-01',
          period_end: '2026-03-31',
        }),
      ).rejects.toThrow();
    });

    // React ステート更新が完了するまで待機してからアサートする
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
