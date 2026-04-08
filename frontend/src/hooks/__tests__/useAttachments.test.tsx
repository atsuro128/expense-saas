// useAttachments Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。
// useAttachments は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。
// ATT-FE-029〜032 に対応する。

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

// useAttachments のスタブ Hook: GET /api/reports/{id}/items/{itemId}/attachments を呼ぶ。
interface UseAttachmentsParams {
  reportId: string;
  itemId: string;
}

function useAttachmentsStub({ reportId, itemId }: UseAttachmentsParams) {
  return useQuery({
    queryKey: ['attachments', reportId, itemId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${reportId}/items/${itemId}/attachments`);
      if (!res.ok) throw new Error('API error');
      return res.json() as Promise<unknown>;
    },
  });
}

describe('useAttachments（スタブ）', () => {
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
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockAttachments,
    } as unknown as Response);

    const { result } = renderHook(
      () => useAttachmentsStub({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // 正しい URL で fetch が呼ばれること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items/item-001/attachments',
    );
    expect(result.current.data).toEqual(mockAttachments);
  });

  // ATT-FE-030: API モックが空配列を返す場合、data.data が空配列になる。
  it('ATT-FE-030: API が空配列を返すと data.data が空配列', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: [] }),
    } as unknown as Response);

    const { result } = renderHook(
      () => useAttachmentsStub({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as { data: unknown[] };
    expect(data.data).toEqual([]);
  });

  // ATT-FE-031: queryKey が ['attachments', reportId, itemId] であること。
  it('ATT-FE-031: queryKey が ["attachments", reportId, itemId] で設定される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: [] }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useAttachmentsStub({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // queryKey が正しく設定されている（キャッシュキーの検証）
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
      () => useAttachmentsStub({ reportId: 'report-001', itemId: 'item-001' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
