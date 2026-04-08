// useUploadAttachment Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-036〜040 に対応する。

import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useUploadAttachment } from '../useUploadAttachment';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUploadAttachment', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-036: POST /api/reports/{reportId}/items/{itemId}/attachments を multipart/form-data で呼び出す。
  it('ATT-FE-036: POST /api/reports/{reportId}/items/{itemId}/attachments を呼び出し、添付情報が返る', async () => {
    const mockCreatedAttachment = {
      data: {
        id: 'att-new',
        item_id: 'item-001',
        file_name: 'receipt.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        created_at: '2026-03-01T00:00:00Z',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => mockCreatedAttachment,
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachment(), { wrapper: createWrapper() });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        file: testFile,
      });
    });

    // 正しい URL と method で fetch が呼ばれること
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/api/reports/report-001/items/item-001/attachments');
    const calledOptions = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    expect(calledOptions?.method).toBe('POST');
    // リクエストボディが FormData であること
    expect(calledOptions?.body).toBeInstanceOf(FormData);
    // 返却値に添付情報が含まれること（ApiResponse<Attachment> 形式）
    expect(result.current.data?.data.id).toBe('att-new');
  });

  // ATT-FE-037: ミューテーション成功後にレポート詳細のクエリキャッシュが無効化される。
  it('ATT-FE-037: ミューテーション成功後にレポート詳細キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: { id: 'att-001', file_name: 'receipt.jpg', mime_type: 'image/jpeg', file_size: 1024, item_id: 'item-001', created_at: '2026-03-01T00:00:00Z' },
      }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUploadAttachment(), { wrapper });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        file: testFile,
      });
    });

    await waitFor(() => {
      // レポート詳細のキャッシュが無効化されること
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-001'] }),
      );
    });
  });

  // ATT-FE-038: API が 422 INVALID_FILE_TYPE を返すと isError=true になる（MIME タイプ不正）。
  it('ATT-FE-038: API が 422 INVALID_FILE_TYPE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'INVALID_FILE_TYPE', message: '許可されていないファイル形式です' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachment(), { wrapper: createWrapper() });

    const gifFile = new File([new ArrayBuffer(1024)], 'receipt.gif', { type: 'image/gif' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', file: gifFile }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    // ApiClientError は code プロパティを持つ
    expect((result.current.error as { code?: string })?.code).toBe('INVALID_FILE_TYPE');
  });

  // ATT-FE-039: API が 413 FILE_TOO_LARGE を返すと isError=true になる（サイズ超過）。
  it('ATT-FE-039: API が 413 FILE_TOO_LARGE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 413,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'FILE_TOO_LARGE', message: 'ファイルサイズが制限を超えています' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachment(), { wrapper: createWrapper() });

    // 5MB を超えるファイル（5,242,881 B）
    const largeFile = new File([new ArrayBuffer(5242881)], 'large.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', file: largeFile }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    expect((result.current.error as { code?: string })?.code).toBe('FILE_TOO_LARGE');
  });

  // ATT-FE-040: API が 422 REPORT_NOT_EDITABLE を返すと isError=true になる（非 draft 状態）。
  it('ATT-FE-040: API が 422 REPORT_NOT_EDITABLE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'REPORT_NOT_EDITABLE', message: 'レポートは編集可能な状態ではありません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachment(), { wrapper: createWrapper() });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'submitted-report-001', itemId: 'item-001', file: testFile }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    expect((result.current.error as { code?: string })?.code).toBe('REPORT_NOT_EDITABLE');
  });
});
