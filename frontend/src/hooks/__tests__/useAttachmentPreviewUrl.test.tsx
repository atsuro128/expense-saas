// useAttachmentPreviewUrl Hook のユニットテスト。
// useAttachmentDownloadUrl と mirror 構造で、URL が /preview になる点のみ異なる。
// ATT-FE-049b 周辺に対応する。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useAttachmentPreviewUrl } from '../useAttachmentPreviewUrl';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useAttachmentPreviewUrl', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-049p-1: enabled: false の検証 — 初期レンダリング時に fetch が呼ばれないこと。
  it('ATT-FE-049p-1: enabled: false のため初期レンダリング時に fetch が呼ばれない', () => {
    globalThis.fetch = vi.fn();

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useAttachmentPreviewUrl({
          reportId: 'report-001',
          itemId: 'item-001',
          attId: 'att-001',
        }),
      { wrapper: Wrapper },
    );

    // enabled: false なので fetchStatus が idle であること。
    expect(result.current.fetchStatus).toBe('idle');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // ATT-FE-049p-2: refetch() 後のみ fetch が呼ばれること（/preview URL を使用）。
  it('ATT-FE-049p-2: refetch() を呼ぶと /preview URL で GET リクエストが送られ、署名付き URL が返る', async () => {
    const mockAccess = {
      data: {
        url: 'https://s3.example.com/preview-signed-url?token=xyz789',
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
      json: async () => mockAccess,
    } as unknown as Response);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useAttachmentPreviewUrl({
          reportId: 'report-001',
          itemId: 'item-001',
          attId: 'att-001',
        }),
      { wrapper: Wrapper },
    );

    // 初期状態では fetch が呼ばれないこと。
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // refetch() を呼ぶと fetch が実行されること。
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // 正しい URL（/preview）で fetch が呼ばれること。
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain(
      '/api/reports/report-001/items/item-001/attachments/att-001/preview',
    );
    // レスポンスに url フィールドが含まれること（AttachmentAccess 形式）。
    expect(result.current.data?.data.url).toBe(
      'https://s3.example.com/preview-signed-url?token=xyz789',
    );
  });

  // ATT-FE-049p-3: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる（添付不存在）。
  it('ATT-FE-049p-3: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる', async () => {
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
      () =>
        useAttachmentPreviewUrl({
          reportId: 'report-001',
          itemId: 'item-001',
          attId: 'att-999',
        }),
      { wrapper: Wrapper },
    );

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // ApiClientError は status プロパティを持つ。
    expect((result.current.error as { status?: number })?.status).toBe(404);
  });

  // ATT-FE-049p-4: API が 403 FORBIDDEN を返すと isError=true になる。
  it('ATT-FE-049p-4: API が 403 FORBIDDEN を返すと isError=true になる', async () => {
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
      () =>
        useAttachmentPreviewUrl({
          reportId: 'report-001',
          itemId: 'item-001',
          attId: 'att-001',
        }),
      { wrapper: Wrapper },
    );

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
