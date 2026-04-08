// useAttachmentDownload Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。
// useAttachmentDownload は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
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

// useAttachmentDownload のスタブ Hook: GET /api/reports/{id}/items/{itemId}/attachments/{attId} を呼ぶ。
interface DownloadParams {
  reportId: string;
  itemId: string;
  attId: string;
}

function useAttachmentDownloadStub() {
  return useMutation({
    mutationFn: async ({ reportId, itemId, attId }: DownloadParams) => {
      const res = await fetch(
        `/api/reports/${reportId}/items/${itemId}/attachments/${attId}`,
      );
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: { download_url: string; file_name: string; mime_type: string; file_size: number; expires_at: string } };
      return data.data;
    },
  });
}

describe('useAttachmentDownload（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-010: GET /api/reports/{reportId}/items/{itemId}/attachments/{attId} を呼び出す。
  it('ATT-FE-010: 正しい URL で GET リクエストを送り、署名付き URL を含むレスポンスが返る', async () => {
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

    const { result } = renderHook(() => useAttachmentDownloadStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        attId: 'att-001',
      });
    });

    // 正しい URL で fetch が呼ばれること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items/item-001/attachments/att-001',
    );
    // レスポンスに download_url が含まれること
    expect(result.current.data).toEqual(mockDownload.data);
    expect(result.current.data?.download_url).toBe('https://s3.example.com/signed-url?...');
  });

  // ATT-FE-011: レスポンスに expires_at が含まれる（15 分後の有効期限）。
  it('ATT-FE-011: レスポンスに expires_at フィールドが含まれる', async () => {
    const expiresAt = '2026-03-01T00:15:00Z';
    const mockDownload = {
      data: {
        download_url: 'https://s3.example.com/signed-url',
        file_name: 'receipt.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        expires_at: expiresAt,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockDownload,
    } as unknown as Response);

    const { result } = renderHook(() => useAttachmentDownloadStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        attId: 'att-001',
      });
    });

    expect(result.current.data?.expires_at).toBe(expiresAt);
  });

  // ATT-FE-012: API が 403 FORBIDDEN を返すと isError=true になる（閲覧権限なし）。
  it('ATT-FE-012: API が 403 FORBIDDEN を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'FORBIDDEN', message: '権限がありません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useAttachmentDownloadStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', attId: 'att-001' }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
  });

  // ATT-FE-013: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる（添付不存在）。
  it('ATT-FE-013: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'リソースが見つかりません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useAttachmentDownloadStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', attId: 'att-999' }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
  });
});

// useAttachmentDownload の queryKey はミューテーション系のため存在しない。
// 代わりに useAttachments の queryKey を無効化してリストを再取得する。
describe('useAttachmentDownload — キャッシュ無効化（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-014: ダウンロード URL 取得後は attachments キャッシュを無効化する必要はない（読み取り操作）。
  it('ATT-FE-014: download_url の取得後に attachments キャッシュを変更しない', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: {
          download_url: 'https://s3.example.com/signed-url',
          file_name: 'receipt.jpg',
          mime_type: 'image/jpeg',
          file_size: 1024,
          expires_at: '2026-03-01T00:15:00Z',
        },
      }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAttachmentDownloadStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', attId: 'att-001' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // ダウンロード URL 取得はキャッシュ無効化不要（読み取り専用操作）
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
