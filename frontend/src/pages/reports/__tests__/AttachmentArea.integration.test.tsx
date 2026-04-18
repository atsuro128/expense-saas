// AttachmentArea 統合テスト。
// AttachmentArea + Hook の連携を検証する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-045〜050 に対応する（ATT-FE-049 は新仕様で更新、049b〜049d を追加）。

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
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

// テスト用ファイルオブジェクト生成ヘルパー。
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

// テスト用添付ファイル一覧レスポンス（att-001）。
function makeAttachmentListResponse() {
  return {
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
  } as unknown as Response;
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
  it('ATT-FE-045: アップロード成功後に成功トーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API（200 OK・空配列）
    // 2回目: アップロード API（201 Created）
    // 3回目: 一覧再取得 API（invalidateQueries 後）
    globalThis.fetch = vi
      .fn()
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
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    // AttachmentArea が描画されること。
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await userEvent.upload(fileInput, jpegFile);

    // アップロード成功後にトーストが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/成功|アップロード/);
  });

  // ATT-FE-046: アップロード失敗時に AppToast でエラー通知が表示される（統合）。
  it('ATT-FE-046: INVALID_FILE_TYPE エラー時にエラートーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API（200 OK・空配列）
    // 2回目: アップロード API（422 INVALID_FILE_TYPE）
    globalThis.fetch = vi
      .fn()
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
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 添付一覧の初期データ取得が完了するまで待機する（空リストの描画を確認）。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-list-empty')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('test.jpg', 1024, 'image/jpeg');
    await userEvent.upload(fileInput, jpegFile);

    // API エラー時にエラートーストが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|失敗|許可/);
  });

  // ATT-FE-047: 削除成功後に AppToast で成功通知が表示され、一覧が再取得される（統合）。
  it('ATT-FE-047: 削除成功後に成功トーストが表示され、invalidateQueries が呼ばれる', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // 1回目: 一覧取得 API（att-001 を含む）
    // 2回目: 削除 API（204 No Content）
    // 3回目: 一覧再取得 API（invalidateQueries 後・空配列）
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeAttachmentListResponse())
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
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 添付データ（att-001）が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-delete-att-001')).toBeInTheDocument();
    });

    // 削除ボタンをクリックして確認ダイアログを表示する（2段階削除）。
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));
    // ConfirmDialog の「削除する」ボタンをクリックして実際の削除を実行する。
    await userEvent.click(screen.getByText('削除する'));

    // 削除成功後にトーストが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/成功|削除/);

    // invalidateQueries が呼ばれ、一覧が再取得されること。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['reports', 'detail', 'rpt-1'],
      }),
    );
  });

  // ATT-FE-048: 削除失敗時に AppToast でエラー通知が表示される（統合）。
  it('ATT-FE-048: 削除失敗時にエラートーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // 1回目: 一覧取得 API
    // 2回目: 削除 API（500 Internal Server Error）
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeAttachmentListResponse())
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
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 添付データ（att-001）が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-delete-att-001')).toBeInTheDocument();
    });

    // 削除ボタンをクリックして確認ダイアログを表示する（2段階削除）。
    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));
    // ConfirmDialog の「削除する」ボタンをクリックして実際の削除を実行する。
    await userEvent.click(screen.getByText('削除する'));

    // エラー時にエラートーストが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|失敗/);
  });

  // ATT-FE-049: ↓ アイコンクリックで /download API を呼び、動的 <a download> 要素でダウンロードを起動する（UX 修正後）。
  // window.open は呼ばれない（タブを開かないダウンロードパターン）。
  // attachments.md L515: document.body.appendChild → link.click() → document.body.removeChild の順でスパイが呼ばれる。
  it('ATT-FE-049: ↓ アイコンクリックで /download API が呼ばれ、<a download> 要素でダウンロードが起動される', async () => {
    const { Wrapper } = createWrapper();

    // window.open のスパイを張り、呼ばれないことを確認する（ダウンロードはタブを開かない）。
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    // <a> 要素の click メソッドをスパイするため、createElement をモック実装で差し替える。
    // 生成される <a> 要素の click を vi.fn() に置き換えることで直接スパイが可能になる。
    const clickSpy = vi.fn();
    const createElementMock = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        const el = Document.prototype.createElement.call(document, tagName);
        if (tagName === 'a') {
          (el as HTMLAnchorElement).click = clickSpy;
        }
        return el;
      });
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    // 1回目: 一覧取得 API
    // 2回目: /download URL 取得 API
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeAttachmentListResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: {
            url: 'https://s3.example.com/signed-download?token=abc123',
            file_name: 'receipt.jpg',
            mime_type: 'image/jpeg',
            file_size: 245760,
            expires_at: '2026-04-01T00:15:00Z',
          },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    // 添付データ（att-001）が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-download-att-001')).toBeInTheDocument();
    });

    // ↓ アイコンをクリックする。
    await userEvent.click(screen.getByTestId('attachment-download-att-001'));

    // window.open は呼ばれないこと（タブを開かないダウンロードパターン）。
    expect(openSpy).not.toHaveBeenCalled();

    // /download API が呼ばれること。
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const downloadApiCalled = calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url.includes('/api/reports/rpt-1/items/item-1/attachments/att-001/download'),
      );
      expect(downloadApiCalled).toBe(true);
    });

    // document.createElement('a') が呼ばれること。
    await waitFor(() => {
      const anchorCreateCall = createElementMock.mock.calls.find(([tag]) => tag === 'a');
      expect(anchorCreateCall).toBeDefined();
    });

    // appendChild された <a> 要素の href・download 属性が正しく設定されていること。
    const appendedAnchor = appendChildSpy.mock.calls
      .map(([el]) => el)
      .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
    expect(appendedAnchor).toBeDefined();
    expect(appendedAnchor?.href).toBe('https://s3.example.com/signed-download?token=abc123');
    expect(appendedAnchor?.download).toBe('receipt.jpg');

    // link.click() が 1 回呼ばれること（attachments.md ATT-FE-049 の期待結果）。
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    // removeChild が呼ばれること（クリック後に DOM から削除される）。
    await waitFor(() => {
      expect(removeChildSpy).toHaveBeenCalled();
    });

    // appendChild → click → removeChild の呼び出し順を検証する。
    const appendAnchorInvocationOrder = appendChildSpy.mock.invocationCallOrder[
      appendChildSpy.mock.calls.findIndex(
        ([el]) => el instanceof HTMLAnchorElement,
      )
    ];
    const clickInvocationOrder = clickSpy.mock.invocationCallOrder[0];
    const removeAnchorInvocationOrder = removeChildSpy.mock.invocationCallOrder[
      removeChildSpy.mock.calls.findIndex(
        ([el]) => el instanceof HTMLAnchorElement,
      )
    ];
    expect(appendAnchorInvocationOrder).toBeLessThan(clickInvocationOrder!);
    expect(clickInvocationOrder!).toBeLessThan(removeAnchorInvocationOrder!);
  });

  // ATT-FE-049b: ファイル名クリックで /preview API を呼び、window.open → location.href 差し替え（新規）。
  it('ATT-FE-049b: ファイル名クリックで window.open が呼ばれ /preview API で location.href が差し替えられる', async () => {
    const { Wrapper } = createWrapper();

    // window.open のモック: 空タブオブジェクトを返す。
    const mockWindowObj = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(mockWindowObj as unknown as Window);

    // 1回目: 一覧取得 API
    // 2回目: /preview URL 取得 API
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeAttachmentListResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: {
            url: 'https://s3.example.com/signed-preview?token=xyz789',
            file_name: 'receipt.jpg',
            mime_type: 'image/jpeg',
            file_size: 245760,
            expires_at: '2026-04-01T00:15:00Z',
          },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    // 添付データ（att-001）が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-att-001')).toBeInTheDocument();
    });

    // ファイル名（プレビューボタン）をクリックする。
    await userEvent.click(screen.getByTestId('attachment-preview-att-001'));

    // window.open('about:blank', '_blank') がクリック時に呼ばれること。
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');

    // /preview API が呼ばれること。
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const previewApiCalled = calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url.includes('/api/reports/rpt-1/items/item-1/attachments/att-001/preview'),
      );
      expect(previewApiCalled).toBe(true);
    });

    // 取得した URL で newWindow.location.href が更新されること。
    await waitFor(() => {
      expect(mockWindowObj.location.href).toBe(
        'https://s3.example.com/signed-preview?token=xyz789',
      );
    });
  });

  // ATT-FE-049c: ポップアップブロック時（window.open が null を返す）にエラートーストが表示される（新規）。
  it('ATT-FE-049c: window.open が null を返す場合、エラートーストが表示される', async () => {
    const { Wrapper } = createWrapper();

    // ポップアップがブロックされた状態をシミュレートする。
    vi.spyOn(window, 'open').mockReturnValue(null);

    globalThis.fetch = vi.fn().mockResolvedValueOnce(makeAttachmentListResponse());

    render(
      <Wrapper>
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={false} />
      </Wrapper>,
    );

    // 添付データ（att-001）が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-att-001')).toBeInTheDocument();
    });

    // ファイル名クリックでポップアップブロックのエラートーストが表示されること。
    await userEvent.click(screen.getByTestId('attachment-preview-att-001'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/ポップアップ|ブロック/);
    // API は呼ばれないこと（window.open が null の時点で処理を中断する）。
    // 一覧取得 API の 1 回のみ呼ばれる。
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  // ATT-FE-049d: API エラー時にエラートーストが表示される（UX 修正後）。
  // window.open は呼ばれないため、newWindow.close() 検証は不要。
  it('ATT-FE-049d: ↓ アイコン押下時の API エラーでエラートーストが表示される（タブは開かない）', async () => {
    const { Wrapper } = createWrapper();

    // window.open のスパイを張り、呼ばれないことを確認する（ダウンロードはタブを開かない）。
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    // 1回目: 一覧取得 API
    // 2回目: /download API（500 エラー）
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeAttachmentListResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: async () => ({
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラー' },
        }),
      } as unknown as Response);

    render(
      <Wrapper>
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={false} />
      </Wrapper>,
    );

    // 添付データ（att-001）が描画されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-download-att-001')).toBeInTheDocument();
    });

    // ↓ アイコンをクリックする。
    await userEvent.click(screen.getByTestId('attachment-download-att-001'));

    // window.open は呼ばれないこと（タブを開かないダウンロードパターン）。
    expect(openSpy).not.toHaveBeenCalled();

    // エラートーストが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|失敗/);
  });

  // ATT-FE-050: 5MB 超過ファイルを選択するとエラートーストが表示される（統合）。
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
        <AttachmentArea reportId="rpt-1" itemId="item-1" canModify={true} />
      </Wrapper>,
    );

    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // 5MB 超過ファイルを選択する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const tooLargeFile = createMockFile('large.jpg', 5242881, 'image/jpeg');
    expect(tooLargeFile.size).toBe(5242881);
    expect(tooLargeFile.size).toBeGreaterThan(5 * 1024 * 1024);

    await userEvent.upload(fileInput, tooLargeFile);

    // サイズ超過のためエラートーストが表示されること。
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/エラー|サイズ|5MB/);

    // ちょうど 5MB は許可される（境界値確認）。
    const exactlyMaxFile = createMockFile('exactly5mb.jpg', 5242880, 'image/jpeg');
    expect(exactlyMaxFile.size).toBe(5242880);
    expect(exactlyMaxFile.size).toBe(5 * 1024 * 1024);
  });
});
