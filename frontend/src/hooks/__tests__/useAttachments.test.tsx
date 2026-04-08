// useAttachments Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-029〜032 に対応する。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useAttachments } from '../useAttachments';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAttachments', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-029: GET /api/reports/{reportId}/items/{itemId}/attachments を呼び出し、添付一覧が返る。
  it('ATT-FE-029: GET /api/reports/{reportId}/items/{itemId}/attachments を呼び出し、添付一覧が返る', async () => {
    const mockAttachments = {
      data: [
        {
          id: 'att-001',
          item_id: 'item-001',
          file_name: 'receipt.jpg',
          file_size: 245760,
          mime_type: 'image/jpeg',
          created_at: '2026-03-01T00:00:00Z',
        },
      ],
      pagination: {
        current_page: 1,
        per_page: 20,
        total_count: 1,
        total_pages: 1,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockAttachments,
    } as unknown as Response);

    const { result } = renderHook(
      () => useAttachments({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // 正しい URL で fetch が呼ばれること
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/reports/report-001/items/item-001/attachments');
    // レスポンスデータに添付ファイル一覧が含まれること
    expect(result.current.data?.data).toBeInstanceOf(Array);
    expect(result.current.data?.data[0]?.id).toBe('att-001');
  });

  // ATT-FE-030: API モックが空配列を返す場合、data.data が空配列になる。
  it('ATT-FE-030: API が空配列を返すと data.data が空配列', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      }),
    } as unknown as Response);

    const { result } = renderHook(
      () => useAttachments({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toEqual([]);
  });

  // ATT-FE-031: queryKey が ['attachments', reportId, itemId] であること。
  it('ATT-FE-031: queryKey が ["attachments", reportId, itemId] で設定される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useAttachments({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // queryKey ['attachments', reportId, itemId] でキャッシュが存在すること
    const cachedData = queryClient.getQueryData(['attachments', 'report-001', 'item-001']);
    expect(cachedData).toBeDefined();
  });

  // ATT-FE-032: API がエラーを返すと isError=true になる（API エラーハンドリング）。
  it('ATT-FE-032: API が 403 FORBIDDEN を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({ error: { code: 'FORBIDDEN', message: '権限がありません' } }),
    } as unknown as Response);

    const { result } = renderHook(
      () => useAttachments({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
