// useUploadAttachment Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため fetch をモックして API 呼び出しをシミュレートする。
// useUploadAttachment は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。

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

// useUploadAttachment のスタブ Hook: multipart/form-data で POST /api/reports/{id}/items/{itemId}/attachments を呼ぶ。
interface UploadParams {
  reportId: string;
  itemId: string;
  file: File;
}

function useUploadAttachmentStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, itemId, file }: UploadParams) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        `/api/reports/${reportId}/items/${itemId}/attachments`,
        {
          method: 'POST',
          body: formData,
        },
      );
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: { id: string; file_name: string; mime_type: string; file_size: number } };
      return data.data;
    },
    onSuccess: (_data, { reportId }) => {
      // レポート詳細のキャッシュを無効化して添付一覧を再取得する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', reportId] });
    },
  });
}

describe('useUploadAttachment（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-020: POST /api/reports/{reportId}/items/{itemId}/attachments を multipart/form-data で呼び出す。
  it('ATT-FE-020: POST /api/reports/{reportId}/items/{itemId}/attachments を呼び出し、添付情報が返る', async () => {
    const mockCreatedAttachment = {
      data: {
        id: 'att-001',
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

    const { result } = renderHook(() => useUploadAttachmentStub(), { wrapper: createWrapper() });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        file: testFile,
      });
    });

    // 正しい URL と method で fetch が呼ばれること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items/item-001/attachments',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.data).toEqual(mockCreatedAttachment.data);
  });

  // ATT-FE-021: リクエストボディが FormData であること（multipart/form-data）。
  it('ATT-FE-021: リクエストボディが FormData で送信される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: { id: 'att-001', file_name: 'receipt.jpg', mime_type: 'image/jpeg', file_size: 1024 },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachmentStub(), { wrapper: createWrapper() });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        file: testFile,
      });
    });

    // リクエストボディが FormData であること
    const calledBody = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body;
    expect(calledBody).toBeInstanceOf(FormData);
  });

  // ATT-FE-022: ミューテーション成功後にレポート詳細のクエリキャッシュが無効化される。
  it('ATT-FE-022: ミューテーション成功後にレポート詳細キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: { id: 'att-001', file_name: 'receipt.jpg', mime_type: 'image/jpeg', file_size: 1024 },
      }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUploadAttachmentStub(), { wrapper });

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

  // ATT-FE-023: API が 422 INVALID_FILE_TYPE を返すと isError=true になる（MIME タイプ不正）。
  it('ATT-FE-023: API が 422 INVALID_FILE_TYPE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'INVALID_FILE_TYPE', message: '許可されていないファイル形式です' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachmentStub(), { wrapper: createWrapper() });

    const gifFile = new File([new ArrayBuffer(1024)], 'receipt.gif', { type: 'image/gif' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', file: gifFile }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    const error = result.current.error as { code?: string };
    expect(error.code).toBe('INVALID_FILE_TYPE');
  });

  // ATT-FE-024: API が 413 FILE_TOO_LARGE を返すと isError=true になる（サイズ超過）。
  it('ATT-FE-024: API が 413 FILE_TOO_LARGE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 413,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'FILE_TOO_LARGE', message: 'ファイルサイズが制限を超えています' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachmentStub(), { wrapper: createWrapper() });

    // 5MB を超えるファイル
    const largeFile = new File([new ArrayBuffer(5242881)], 'large.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', file: largeFile }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    const error = result.current.error as { code?: string };
    expect(error.code).toBe('FILE_TOO_LARGE');
  });

  // ATT-FE-025: API が 422 REPORT_NOT_EDITABLE を返すと isError=true になる（非 draft 状態）。
  it('ATT-FE-025: API が 422 REPORT_NOT_EDITABLE を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'REPORT_NOT_EDITABLE', message: 'レポートは編集可能な状態ではありません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUploadAttachmentStub(), { wrapper: createWrapper() });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reportId: 'submitted-report-001', itemId: 'item-001', file: testFile }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
    const error = result.current.error as { code?: string };
    expect(error.code).toBe('REPORT_NOT_EDITABLE');
  });
});
