// useAttachmentDownload Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-033〜035 に対応する。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useAttachmentDownload } from '../useAttachmentDownload';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return { queryClient, Wrapper: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ) };
}

describe('useAttachmentDownload', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-033: 正しい URL で GET リクエストを送り、署名付き URL を含むレスポンスが返る。
  it('ATT-FE-033: 正しい URL で GET リクエストを送り、署名付き URL を含むレスポンスが返る', async () => {
    const mockDownload = {
      data: {
        download_url: 'https://s3.example.com/signed-url?...',
        file_name: 'receipt.jpg',
        mime_type: 'image/jpeg',
        file_size: 245760,
        expires_at: '2026-03-01T00:15:00Z',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockDownload,
    } as unknown as Response);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAttachmentDownload({ reportId: 'report-001', itemId: 'item-001', attId: 'att-001' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // 正しい URL で fetch が呼ばれること
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/reports/report-001/items/item-001/attachments/att-001');
    // レスポンスに download_url が含まれること（ApiResponse<AttachmentDownload> 形式）
    expect(result.current.data?.data.download_url).toBe('https://s3.example.com/signed-url?...');
  });

  // ATT-FE-034: staleTime=0 であること（署名付き URL は毎回取得）。
  it('ATT-FE-034: staleTime=0 で、同一パラメータでも毎回サーバーから取得する', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: {
            download_url: `https://s3.example.com/signed-url-${callCount}`,
            file_name: 'receipt.jpg',
            mime_type: 'image/jpeg',
            file_size: 1024,
            expires_at: '2026-03-01T00:15:00Z',
          },
        }),
      } as unknown as Response;
    });

    const { queryClient, Wrapper } = createWrapper();
    const params = { reportId: 'report-001', itemId: 'item-001', attId: 'att-001' };

    const { result } = renderHook(
      () => useAttachmentDownload(params),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // staleTime=0 のため、invalidate すると即座に refetch される
    await queryClient.invalidateQueries({
      queryKey: ['reports', 'report-001', 'items', 'item-001', 'attachments', 'att-001'],
    });

    await waitFor(() => {
      // 2回以上 fetch が呼ばれること（staleTime=0 なら即座に refetch）
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ATT-FE-035: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる（添付不存在）。
  it('ATT-FE-035: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'リソースが見つかりません' },
      }),
    } as unknown as Response);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAttachmentDownload({ reportId: 'report-001', itemId: 'item-001', attId: 'att-999' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // ApiClientError は status プロパティを持つ
    expect((result.current.error as { status?: number })?.status).toBe(404);
  });
});

// 403 FORBIDDEN のテスト（ATT-FE-035 の追加検証）。
describe('useAttachmentDownload — 権限エラー', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('ATT-FE-035b: API が 403 FORBIDDEN を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'FORBIDDEN', message: '権限がありません' },
      }),
    } as unknown as Response);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAttachmentDownload({ reportId: 'report-001', itemId: 'item-001', attId: 'att-001' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
