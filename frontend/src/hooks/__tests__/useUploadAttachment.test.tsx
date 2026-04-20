// useUploadAttachment Hook のユニットテスト。
// report-detail.md §添付ファイル操作のデータフロー に対応する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-036〜040, ATT-FE-059 に対応する。
// ATT-FE-059 は機能実装フェーズ（issue #108 対応）で green になる想定（AbortController 未実装のため FAIL）。

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

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
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
    // mutateAsync の返り値を直接検証する（result.current.data は再レンダー待ちが必要なため）
    expect((response as { data: { id: string } })?.data?.id).toBe('att-new');
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

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', file: gifFile });
      } catch (e) {
        thrownError = e;
      }
    });

    // mutateAsync が reject されること
    expect(thrownError).toBeDefined();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
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

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ reportId: 'report-001', itemId: 'item-001', file: largeFile });
      } catch (e) {
        thrownError = e;
      }
    });

    expect(thrownError).toBeDefined();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
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

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ reportId: 'submitted-report-001', itemId: 'item-001', file: testFile });
      } catch (e) {
        thrownError = e;
      }
    });

    expect(thrownError).toBeDefined();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect((result.current.error as { code?: string })?.code).toBe('REPORT_NOT_EDITABLE');
  });

  // ATT-FE-059: unmount 時に AbortController.abort() が呼ばれ、進行中の fetch が中断される。
  // 機能実装フェーズ（issue #108 対応）で green になる想定（AbortController が未実装のため FAIL）。
  it('ATT-FE-059: aborts_upload_mutation_on_panel_close', async () => {
    // AbortController のグローバルスパイを設定する。
    const abortSpy = vi.fn();
    const originalAbortController = globalThis.AbortController;

    // AbortController をラップしてスパイする。
    class SpyAbortController extends originalAbortController {
      constructor() {
        super();
        // abort() が呼ばれたとき記録する。
        const originalAbort = this.abort.bind(this);
        this.abort = (...args: Parameters<typeof originalAbort>) => {
          abortSpy(...args);
          return originalAbort(...args);
        };
      }
    }
    globalThis.AbortController = SpyAbortController as typeof AbortController;

    // fetch をレスポンスを遅延させるモックで設定する（パネル閉じ相当の unmount を試みる前に解決しない）。
    let resolveFetch!: (value: Response) => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useUploadAttachment(), {
      wrapper: createWrapper(),
    });

    const testFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });

    // mutation を開始（await しない: レスポンス待ち状態のままにする）。
    act(() => {
      result.current.mutate({
        reportId: 'rpt-1',
        itemId: 'item-1',
        file: testFile,
      });
    });

    // コンポーネント unmount（パネル閉じ相当）。
    unmount();

    // AbortController.abort() が呼ばれていること。
    expect(abortSpy).toHaveBeenCalled();

    // cleanup: 遅延中の fetch を解決して Promise が宙吊りにならないようにする。
    resolveFetch({
      ok: false,
      status: 0,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);

    // AbortController をリストアする。
    globalThis.AbortController = originalAbortController;
  });
});
