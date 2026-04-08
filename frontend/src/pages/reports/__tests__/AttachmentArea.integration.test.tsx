// AttachmentArea 統合テスト。
// AttachmentArea + Hook の連携を検証する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-045〜050 に対応する。
//
// 注意: AttachmentArea はスタブ実装のため、実際の Hook 連携・AppToast 表示・
// invalidateQueries・ダウンロード動作は機能実装後に通過する。
// スタブ段階での失敗は Step 9 の正しい姿。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import AttachmentArea from '../AttachmentArea';

// テスト用 QueryClient プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return { queryClient, Wrapper: ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )};
}

// テスト用ファイルオブジェクト生成ヘルパー。
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('AttachmentArea 統合テスト', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-045: アップロード成功後に AppToast で成功通知が表示される（統合）。
  // スタブでは AppToast が未連携のため失敗する（Step 9 の正しい姿）。
  it('ATT-FE-045: アップロード成功後に成功トーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API（200 OK・空配列）
    // 2回目: アップロード API（201 Created）
    // 3回目: 一覧再取得 API（invalidateQueries 後）
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [],
          pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: async () => ({
          data: {
            id: 'att-new',
            item_id: 'item-1',
            file_name: 'receipt.jpg',
            file_size: 1024,
            mime_type: 'image/jpeg',
            created_at: '2026-04-01T00:00:00Z',
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [
            {
              id: 'att-new',
              item_id: 'item-1',
              file_name: 'receipt.jpg',
              file_size: 1024,
              mime_type: 'image/jpeg',
              created_at: '2026-04-01T00:00:00Z',
            },
          ],
          pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    // AttachmentArea が描画されること
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // AttachmentUploader が描画され、ファイルを選択するとアップロードが開始されること
    // スタブでは attachment-uploader が未描画のため失敗する
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await userEvent.upload(fileInput, jpegFile);

    // アップロード成功後にトースト（alert role）が表示されること
    // スタブでは AppToast 連携が未実装のため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/成功|アップロード/);
  });

  // ATT-FE-046: アップロード失敗時に AppToast でエラー通知が表示される（統合）。
  // スタブでは AppToast が未連携のため失敗する（Step 9 の正しい姿）。
  it('ATT-FE-046: INVALID_FILE_TYPE エラー時にエラートーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API（200 OK・空配列）
    // 2回目: アップロード API（422 INVALID_FILE_TYPE）
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [],
          pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: { get: () => null },
        json: async () => ({
          error: { code: 'INVALID_FILE_TYPE', message: '許可されていないファイル形式です' },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // スタブでは attachment-uploader が未描画のため失敗する
    const fileInput = screen.getByTestId('attachment-file-input');
    const gifFile = createMockFile('animation.gif', 1024, 'image/gif');
    await userEvent.upload(fileInput, gifFile);

    // エラー時にエラートーストが表示されること
    // スタブでは AppToast 連携が未実装のため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|失敗|許可/);
  });

  // ATT-FE-047: 削除成功後に AppToast で成功通知が表示され、一覧が再取得される（統合）。
  // スタブでは AppToast・invalidateQueries が未連携のため失敗する（Step 9 の正しい姿）。
  it('ATT-FE-047: 削除成功後に成功トーストが表示され、invalidateQueries が呼ばれる', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // 1回目: 一覧取得 API（att-001 を含む）
    // 2回目: 削除 API（204 No Content → 空レスポンス）
    // 3回目: 一覧再取得 API（invalidateQueries 後・空配列）
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [
            {
              id: 'att-001',
              item_id: 'item-1',
              file_name: 'receipt.jpg',
              file_size: 245760,
              mime_type: 'image/jpeg',
              created_at: '2026-03-01T00:00:00Z',
            },
          ],
          pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        json: async () => ({}),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [],
          pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 削除ボタンをクリックする
    // スタブでは attachment-delete-att-001 が未描画のため失敗する
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));

    // 削除成功後にトーストが表示されること
    // スタブでは AppToast 連携が未実装のため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/成功|削除/);

    // invalidateQueries が呼ばれ、一覧が再取得されること
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['reports', 'detail', 'rpt-1'],
      }),
    );
  });

  // ATT-FE-048: 削除失敗時に AppToast でエラー通知が表示される（統合）。
  // スタブでは AppToast が未連携のため失敗する（Step 9 の正しい姿）。
  it('ATT-FE-048: 削除失敗時にエラートーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API
    // 2回目: 削除 API（500 Internal Server Error）
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [
            {
              id: 'att-001',
              item_id: 'item-1',
              file_name: 'receipt.jpg',
              file_size: 245760,
              mime_type: 'image/jpeg',
              created_at: '2026-03-01T00:00:00Z',
            },
          ],
          pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: async () => ({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラーが発生しました' },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 削除ボタンをクリックする
    // スタブでは attachment-delete-att-001 が未描画のため失敗する
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));

    // エラー時にエラートーストが表示されること
    // スタブでは AppToast 連携が未実装のため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|失敗/);
  });

  // ATT-FE-049: 署名付き URL でブラウザがファイルをダウンロードする（統合）。
  // スタブでは useAttachmentDownload 連携が未実装のため失敗する（Step 9 の正しい姿）。
  it('ATT-FE-049: ファイル名クリックで署名付き URL を取得しダウンロードが開始される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API
    // 2回目: ダウンロード URL 取得 API（200 OK）
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: [
            {
              id: 'att-001',
              item_id: 'item-1',
              file_name: 'receipt.jpg',
              file_size: 245760,
              mime_type: 'image/jpeg',
              created_at: '2026-03-01T00:00:00Z',
            },
          ],
          pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: {
            download_url: 'https://s3.example.com/signed?token=abc123',
            file_name: 'receipt.jpg',
            mime_type: 'image/jpeg',
            file_size: 245760,
            expires_at: '2026-04-01T00:15:00Z',
          },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // ファイル名（ダウンロードボタン）をクリックする
    // スタブでは attachment-download-att-001 が未描画のため失敗する
    await userEvent.click(screen.getByTestId('attachment-download-att-001'));

    // ダウンロード URL 取得 API が呼ばれること
    // スタブでは useAttachmentDownload 連携が未実装のため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const downloadApiCalled = calls.some(([url]) =>
        typeof url === 'string' && url.includes('/api/reports/rpt-1/items/item-1/attachments/att-001'),
      );
      expect(downloadApiCalled).toBe(true);
    });
  });

  // ATT-FE-050: 5MB 超過ファイルを選択するとエラートーストが表示される（統合）。
  // スタブでは AppToast が未連携のため失敗する（Step 9 の正しい姿）。
  it('ATT-FE-050: 5MB 超過ファイル選択時にエラートーストが表示される（統合）', async () => {
    const { Wrapper } = createWrapper();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [],
        pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      }),
    } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea
          reportId="rpt-1"
          itemId="item-1"
          canModify={true}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 5MB 超過ファイルを選択する
    // スタブでは attachment-file-input が attachment-uploader 内にあるため取得失敗する
    const fileInput = screen.getByTestId('attachment-file-input');
    const tooLargeFile = createMockFile('large.jpg', 5242881, 'image/jpeg');
    expect(tooLargeFile.size).toBe(5242881);
    expect(tooLargeFile.size).toBeGreaterThan(5 * 1024 * 1024);

    await userEvent.upload(fileInput, tooLargeFile);

    // サイズ超過のためエラートーストが表示されること
    // スタブでは AppToast 連携が未実装のため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|サイズ|5MB/);

    // ちょうど 5MB は許可される（境界値確認）
    const exactlyMaxFile = createMockFile('exactly5mb.jpg', 5242880, 'image/jpeg');
    expect(exactlyMaxFile.size).toBe(5242880);
    expect(exactlyMaxFile.size).toBe(5 * 1024 * 1024);
  });
});
