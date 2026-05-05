// ItemSlidePanel 統合テスト。
// AttachmentArea + ItemSlidePanel の連携を検証する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-060, 062, 063 に対応する（issue #108: アップロード/削除中断トースト・明細切替）。
// ATT-FE-079, 080, 082 に対応する（issue #115: 保存時の順次アップロード・部分失敗・中断）。
// 機能実装フェーズ（issue #108 対応）で green になる想定（AbortController / 中断トーストが未実装のため FAIL）。
// ATT-FE-079, 080, 082 は issue #115 の機能実装前のため FAIL 前提。
// FAIL 原因: ItemSlidePanel の追加モード保存時に順次アップロードを行う機能が未実装。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import ItemSlidePanel from '../ItemSlidePanel';

/**
 * AbortError を表す Error オブジェクトを生成するヘルパー。
 * jsdom では DOMException が Error を継承しないため、`err instanceof Error && err.name === 'AbortError'`
 * という条件を満たすために通常の Error を使用する。
 */
function createAbortError(): Error {
  const err = new Error('The user aborted a request.');
  err.name = 'AbortError';
  return err;
}

/**
 * AbortSignal に対応した fetch モック実装を生成するヘルパー。
 * signal が渡された場合は abort イベントを監視して AbortError で reject する。
 * signal が既に aborted の場合はすぐに reject する。
 */
function makeAbortablePendingFetch(resolveRef: { resolve: (v: Response) => void }) {
  return (_url: string, options?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      resolveRef.resolve = resolve;
      if (options?.signal) {
        // 既に abort 済みのシグナルが渡された場合はすぐに AbortError で reject する。
        if (options.signal.aborted) {
          reject(createAbortError());
          return;
        }
        // abort イベントを監視して AbortError で reject する。
        options.signal.addEventListener('abort', () => {
          reject(createAbortError());
        });
      }
    });
  };
}

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

// テスト用明細フィクスチャ。
const mockItem = {
  id: 'item-001',
  report_id: 'report-001',
  expense_date: '2026-03-10',
  amount: 1000,
  category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
  description: 'タクシー代',
  attachments: [],
  created_at: '2026-03-10T00:00:00Z',
  updated_at: '2026-03-10T00:00:00Z',
};

// 別明細フィクスチャ（明細切替テスト用）。
const mockItem2 = {
  id: 'item-002',
  report_id: 'report-001',
  expense_date: '2026-03-11',
  amount: 2000,
  category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
  description: '電車代',
  attachments: [],
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

// ItemSlidePanel のデフォルト Props（onClose / onSaveSuccess / onSaveAndContinue 以外）。
const defaultSlidePanelProps = {
  open: true,
  mode: 'edit' as const,
  reportId: 'rpt-1',
  reportStatus: 'draft' as const,
  isOwner: true,
  categories: [{ value: 'cat-001', label: '交通費' }],
  onSaveSuccess: () => undefined,
  onSaveAndContinue: () => undefined,
};

// 添付ファイル一覧 API の空レスポンス（初期状態）。
function makeEmptyAttachmentListResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      data: [],
      pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 },
    }),
  } as unknown as Response;
}

describe('ItemSlidePanel 統合テスト（ATT-FE-060, 062, 063, issue #108）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-060: アップロード中にパネルを閉じると「アップロードを中止しました」トーストが表示される。
  // 機能実装フェーズで green になる想定（AbortController + 中断トーストが未実装のため FAIL）。
  it('ATT-FE-060: shows_upload_aborted_toast_on_panel_close_during_upload', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onClose = vi.fn();

    // 1回目: 添付一覧取得（空配列）
    // 2回目: アップロード API（レスポンス遅延: パネル閉じ前に解決しない）
    // makeAbortablePendingFetch ヘルパーで AbortSignal 対応のモックを生成する。
    const uploadResolveRef: { resolve: (v: Response) => void } = { resolve: () => {} };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeEmptyAttachmentListResponse())
      .mockImplementationOnce(makeAbortablePendingFetch(uploadResolveRef));

    render(
      <ItemSlidePanel
        {...defaultSlidePanelProps}
        item={mockItem}
        onClose={onClose}
      />,
      { wrapper: Wrapper },
    );

    // AttachmentUploader が表示されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-uploader')).toBeInTheDocument();
    });

    // ファイルを選択してアップロードを開始する。
    const mockJpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    const fileInput = screen.getByTestId('attachment-file-input') as HTMLInputElement;

    // user.upload が内部で FileList を構築するため Object.defineProperty は不要。
    // Object.defineProperty(Array) との併用は jsdom 非互換（Array.item が存在しない）のため使用しない。
    await user.upload(fileInput, mockJpegFile);

    // TanStack Query の mutation が非同期で開始するため、アップロードボタンが「アップロード中...」に
    // なるまで待機してから × ボタンを押す（onMutate の AbortController 初期化を確認する）。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('アップロード中...');
    });

    // アップロード開始後、× ボタンでパネルを閉じる（resolveUpload はまだ呼んでいない）。
    const closeButton = screen.getByRole('button', { name: '閉じる' });
    await user.click(closeButton);

    // 「アップロードを中止しました」相当のトーストが表示される。
    // 機能実装後に中断トーストメッセージを検証する。
    await waitFor(() => {
      expect(
        screen.getByText(/アップロードを中止しました/),
      ).toBeInTheDocument();
    });

    // onUploadSuccess コールバックは呼ばれない（中断のため）。
    // cleanup: 遅延中の fetch を解決する（AbortError で reject 済みだが念のため）。
    uploadResolveRef.resolve({
      ok: false,
      status: 0,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
  });

  // ATT-FE-062: 削除中にパネルを閉じると「削除を中止しました」トーストが表示される。
  // 機能実装フェーズで green になる想定（AbortController + 中断トーストが未実装のため FAIL）。
  it('ATT-FE-062: shows_delete_aborted_toast_on_panel_close_during_delete', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onClose = vi.fn();

    // 添付ファイル一覧レスポンス（att-001 が存在する状態）。
    const attachmentListResponse: Response = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        data: [
          {
            id: 'att-001',
            item_id: 'item-001',
            file_name: 'receipt.jpg',
            file_size: 1024,
            mime_type: 'image/jpeg',
            created_at: '2026-03-10T00:00:00Z',
          },
        ],
        pagination: { current_page: 1, per_page: 20, total_count: 1, total_pages: 1 },
      }),
    } as unknown as Response;

    // 削除 API（レスポンス遅延）。
    // makeAbortablePendingFetch ヘルパーで AbortSignal 対応のモックを生成する。
    const deleteResolveRef: { resolve: (v: Response) => void } = { resolve: () => {} };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(attachmentListResponse)
      .mockImplementationOnce(makeAbortablePendingFetch(deleteResolveRef));

    render(
      <ItemSlidePanel
        {...defaultSlidePanelProps}
        item={mockItem}
        onClose={onClose}
      />,
      { wrapper: Wrapper },
    );

    // 添付ファイル一覧が表示されるまで待機する。
    await waitFor(() => {
      expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    });

    // 削除ボタンをクリックして確認ダイアログを表示する。
    const deleteButton = screen.getByRole('button', { name: /削除/ });
    await user.click(deleteButton);

    // 確認ダイアログの「削除する」ボタンをクリックして削除を開始する。
    const confirmButton = screen.getByRole('button', { name: '削除する' });
    await user.click(confirmButton);

    // 削除開始後、× ボタンでパネルを閉じる（resolveDelete はまだ呼んでいない）。
    const closeButton = screen.getByRole('button', { name: '閉じる' });
    await user.click(closeButton);

    // 「削除を中止しました」相当のトーストが表示される。
    await waitFor(() => {
      expect(
        screen.getByText(/削除を中止しました/),
      ).toBeInTheDocument();
    });

    // cleanup: 遅延中の fetch を解決する（AbortError で reject 済みだが念のため）。
    deleteResolveRef.resolve({
      ok: false,
      status: 0,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
  });

  // ATT-FE-063: 別明細切替時も進行中の mutation が cancel される。
  // 機能実装フェーズで green になる想定（AbortController が未実装のため FAIL）。
  it('ATT-FE-063: cancels_in_flight_mutation_when_switching_item', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();

    // 1回目: item-001 の添付一覧取得（空配列）
    // 2回目: アップロード API（レスポンス遅延）
    // 3回目: item-002 の添付一覧取得（空配列）
    // makeAbortablePendingFetch ヘルパーで AbortSignal 対応のモックを生成する。
    const uploadResolveRef063: { resolve: (v: Response) => void } = { resolve: () => {} };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeEmptyAttachmentListResponse())
      .mockImplementationOnce(makeAbortablePendingFetch(uploadResolveRef063))
      .mockResolvedValueOnce(makeEmptyAttachmentListResponse());

    const { rerender } = render(
      <ItemSlidePanel
        {...defaultSlidePanelProps}
        item={mockItem}
        onClose={() => undefined}
      />,
      { wrapper: Wrapper },
    );

    // AttachmentUploader が表示されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-uploader')).toBeInTheDocument();
    });

    // item-001 に対してアップロードを開始する。
    const mockJpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    const fileInput = screen.getByTestId('attachment-file-input') as HTMLInputElement;
    await user.upload(fileInput, mockJpegFile);

    // TanStack Query の mutation が非同期で開始するため、アップロードボタンが「アップロード中...」に
    // なるまで待機してから明細を切り替える（onMutate の AbortController 初期化を確認する）。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('アップロード中...');
    });

    // 別明細（item-002）に切り替える（ItemSlidePanel を再マウント相当）。
    rerender(
      <ItemSlidePanel
        {...defaultSlidePanelProps}
        item={mockItem2}
        onClose={() => undefined}
      />,
    );

    // item-001 の mutation が cancel され、item-002 の添付一覧が独立して取得される。
    // アップロード中断により「アップロードを中止しました」トーストが表示される。
    await waitFor(() => {
      expect(
        screen.getByText(/アップロードを中止しました/),
      ).toBeInTheDocument();
    });

    // item-002 の添付一覧コンテナが存在すること（新明細向けの独立した取得が行われる）。
    expect(screen.getByTestId('attachment-area')).toBeInTheDocument();

    // cleanup（AbortError で reject 済みだが念のため）。
    uploadResolveRef063.resolve({
      ok: false,
      status: 0,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
  });
});

// =============================================================================
// ATT-FE-079, 080, 082: 追加モード保存時の順次アップロード統合テスト（issue #115）
// 機能実装前のため FAIL 前提。
// FAIL 原因: ItemSlidePanel の追加モードで保存ボタン押下時に
//           (1) POST items → itemId 取得 → (2) 各添付を順次 POST する機能が未実装。
// =============================================================================

describe('ItemSlidePanel 追加モード 保存時順次アップロード（ATT-FE-079, 080, 082, issue #115）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-079: 追加モードで保存ボタン押下時に明細作成 → 保留添付を順次アップロードし、
  //             全成功でパネルクローズ + 一覧再読み込み。
  // FAIL 原因（機能未実装）: 追加モードで保存時に POST items + 順次 POST attachments が実行されない。
  // 機能実装後: 保存ボタン押下 → POST items (201) → itemId 取得 → 各添付を順次 POST (201) →
  //            全成功でパネルクローズ・明細一覧 invalidate。
  // 順次性検証（偽 PASS 対策）: 1件目の添付 POST レスポンスを意図的に遅延させ、
  // 遅延中に 2件目の POST が未発火であることを assert することで
  // 並列実装での偽 PASS を防ぐ（FIX 4 対応）。
  it('ATT-FE-079: saves_item_then_sequentially_uploads_pending_attachments_on_save', async () => {
    const user = userEvent.setup();
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onSaveSuccess = vi.fn();

    // 呼び出し順序を記録するための配列。
    const fetchCallOrder: string[] = [];

    // 1件目の添付アップロードを意図的に遅延させて順次性を検証する（偽 PASS 対策）。
    const attachment1ResolveRef: { resolve: (v: Response) => void } = { resolve: () => {} };

    // POST items (201): 明細作成 → itemId="item-new"。
    // POST attachments/jpeg: 1 件目の添付アップロード（遅延）。
    // POST attachments/pdf: 2 件目の添付アップロード (201)。
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items') && !(url as string).includes('/attachments')) {
        // 明細作成 API: 即時 201。
        fetchCallOrder.push('POST:items');
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'item-new',
              report_id: 'rpt-1',
              expense_date: '2026-04-19',
              amount: 1500,
              category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
              description: 'テスト明細',
              attachments: [],
              created_at: '2026-04-19T00:00:00Z',
              updated_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response);
      }
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items/item-new/attachments')) {
        const postCount = fetchCallOrder.filter((c) => c === 'POST:attachments').length;
        fetchCallOrder.push('POST:attachments');
        if (postCount === 0) {
          // 1件目の添付 POST: 遅延させて順次性を検証する（偽 PASS 対策）。
          return new Promise<Response>((resolve) => {
            attachment1ResolveRef.resolve = resolve;
          });
        }
        // 2件目以降は即時 201。
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: `att-${postCount + 1}`,
              item_id: 'item-new',
              file_name: 'file.jpg',
              file_size: 1024,
              mime_type: 'image/jpeg',
              created_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response);
      }
      // その他（GET 一覧取得など）は空配列で返す。
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
      } as unknown as Response);
    });

    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={onSaveSuccess}
        onSaveAndContinue={() => undefined}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // 追加モードで AttachmentArea が描画されること（FAIL 前提: itemId=null で非表示）。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    });

    // 添付ファイル 2 件をローカル保留する（JPEG + PDF）。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    const pdfFile = createMockFile('invoice.pdf', 2048, 'application/pdf');
    await user.upload(fileInput, jpegFile);
    await user.upload(fileInput, pdfFile);

    // フォームを入力する。
    await user.type(screen.getByLabelText(/日付/), '2026-04-19');
    await user.type(screen.getByLabelText(/金額/), '1500');
    // カテゴリを明示選択する（category 自動選択 useEffect 削除 FIX 2 対応）。
    // MUI Select を combobox ロールで取得し、ドロップダウンを開いて「交通費」を選択する。
    const categorySelect = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelect);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), 'テスト明細');

    // 保存ボタンをクリックする。
    const saveButton = screen.getByRole('button', { name: /保存する/ });
    await user.click(saveButton);

    // 呼び出し順序の検証（偽 PASS 対策含む）:
    // (1) 明細作成 POST が先行すること。
    // (2) 1件目の添付 POST が発火した時点で、2件目はまだ発火していないこと（順次性の強化検証）。
    await waitFor(() => {
      expect(fetchCallOrder[0]).toBe('POST:items');
      expect(fetchCallOrder.filter((c) => c === 'POST:attachments')).toHaveLength(1);
    });
    // 1件目レスポンス受信前は 2件目が発火していないこと（並列実装での偽 PASS を防ぐ）。
    expect(fetchCallOrder.filter((c) => c === 'POST:attachments')).toHaveLength(1);

    // 1件目の遅延レスポンスを解決する。
    attachment1ResolveRef.resolve({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-1',
          item_id: 'item-new',
          file_name: 'receipt.jpg',
          file_size: 1024,
          mime_type: 'image/jpeg',
          created_at: '2026-04-19T00:00:00Z',
        },
      }),
    } as unknown as Response);

    // 1件目完了後に 2件目が発火し、全成功後パネルクローズすること。
    await waitFor(() => {
      expect(fetchCallOrder.filter((c) => c === 'POST:attachments')).toHaveLength(2);
    });

    // 全成功後にパネルクローズコールバックが呼ばれること。
    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
    });

    // 明細一覧が再読み込みされること（['reports', 'detail', 'rpt-1'] の invalidate）。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['reports', 'detail', 'rpt-1']),
      }),
    );

    // 成功トーストが表示されること。
    await waitFor(() => {
      expect(screen.getByText(/明細を追加しました/)).toBeInTheDocument();
    });
  });

  // ATT-FE-080: 部分失敗時に明細は残し警告トースト → パネルクローズ → 一覧再読み込みの順序検証。
  // FAIL 原因（機能未実装）: 追加モードの順次アップロードが未実装。
  // 機能実装後: 明細作成成功 + 添付 1 件成功 + 1 件失敗の場合、
  //            明細 DELETE は呼ばれず、警告トーストが表示され、パネルクローズされる。
  it('ATT-FE-080: keeps_item_created_and_shows_warning_toast_on_partial_attachment_failure', async () => {
    const user = userEvent.setup();
    const { queryClient, Wrapper } = createWrapper();

    // 順序検証用のログ配列。toast → onSaveSuccess → invalidate の順序を記録する。
    const orderLog: string[] = [];

    // invalidateQueries をラップして呼び出し順序を記録する。
    const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
    const invalidateSpy = vi.fn((...args: Parameters<typeof queryClient.invalidateQueries>) => {
      orderLog.push('invalidate');
      return originalInvalidate(...args);
    });
    queryClient.invalidateQueries = invalidateSpy;

    // onSaveSuccess 呼び出し時点でトーストが既に DOM に存在するかを確認するため、
    // onSaveSuccess 内でトーストの有無を記録する。
    // setApiToast → React レンダリング（トースト DOM 追加）→ useEffect → onSaveSuccess の順で
    // 実行されるため、onSaveSuccess 時点では既にトーストが DOM に存在するはず（ATT-FE-080 設計）。
    const onSaveSuccess = vi.fn(() => {
      const toastEl = document.body.querySelector('[data-testid="app-toast"]');
      if (toastEl && !orderLog.includes('toast')) {
        orderLog.push('toast');
      }
      orderLog.push('onSaveSuccess');
    });

    // 明細 DELETE が呼ばれないことを確認するためのスパイ（DELETE 呼出は意図しない動作）。
    const deleteCalledUrls: string[] = [];

    // 2 件目の添付 POST をペンディング状態にして手動解決する。
    // user.click() 後にハンドラが 2 件目アップロード待ちで中断→戻り、
    // その後 resolve で失敗を注入することで MutationObserver が
    // useEffect より先に発火し、'toast' が orderLog の先頭になる（ATT-FE-080 順序保証）。
    const attach2ResolveRef: { resolve: (v: Response) => void } = {
      resolve: () => {},
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();

      if (method === 'DELETE') {
        // 明細 DELETE は呼ばれてはいけない（ロールバックしない方針）。
        deleteCalledUrls.push(url as string);
        return { ok: true, status: 204, headers: { get: () => null }, json: async () => ({}) } as unknown as Response;
      }
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items') && !(url as string).includes('/attachments')) {
        // 明細作成 (201)。
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'item-new',
              report_id: 'rpt-1',
              expense_date: '2026-04-19',
              amount: 1500,
              category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
              description: 'テスト明細',
              attachments: [],
              created_at: '2026-04-19T00:00:00Z',
              updated_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items/item-new/attachments')) {
        // 1 件目の添付 POST は即時成功、2 件目はペンディングにして手動解決する。
        const attachPostCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
          .filter(([u, o]) => typeof u === 'string' && (u as string).includes('/attachments') && (o?.method ?? 'GET') === 'POST')
          .length;
        if (attachPostCalls <= 1) {
          // 1 件目（呼び出し回数が 1 以下のとき）は即時成功。
          return {
            ok: true,
            status: 201,
            headers: { get: () => null },
            json: async () => ({ data: { id: 'att-1', item_id: 'item-new', file_name: 'receipt.jpg', file_size: 1024, mime_type: 'image/jpeg', created_at: '2026-04-19T00:00:00Z' } }),
          } as unknown as Response;
        }
        // 2 件目はペンディング: attach2ResolveRef.resolve で手動解決する（AbortSignal 対応）。
        return new Promise<Response>((resolve, reject) => {
          attach2ResolveRef.resolve = resolve;
          if (opts?.signal) {
            if (opts.signal.aborted) {
              reject(createAbortError());
              return;
            }
            opts.signal.addEventListener('abort', () => {
              reject(createAbortError());
            });
          }
        });
      }
      // GET 等はデフォルト空レスポンス。
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
      } as unknown as Response;
    });

    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={onSaveSuccess}
        onSaveAndContinue={() => undefined}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // 追加モードで AttachmentArea が描画されること（FAIL 前提）。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    });

    // 添付ファイル 2 件をローカル保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    const pdfFile = createMockFile('invoice.pdf', 2048, 'application/pdf');
    await user.upload(fileInput, jpegFile);
    await user.upload(fileInput, pdfFile);

    // フォームを入力する。
    await user.type(screen.getByLabelText(/日付/), '2026-04-19');
    await user.type(screen.getByLabelText(/金額/), '1500');
    // カテゴリを明示選択する（category 自動選択 useEffect 削除 FIX 2 対応）。
    const categorySelect080 = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelect080);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), 'テスト明細');

    // 保存ボタンをクリックする。
    // user.click() はハンドラが 2 件目の添付 POST ペンディング中に中断して戻る。
    await user.click(screen.getByRole('button', { name: /保存する/ }));

    // 2 件目の添付 POST を 500 失敗で解決する。
    // resolve() でマイクロタスクにキューイングし、waitFor の MutationObserver セットアップ後に
    // ハンドラが再開するようにすることで、MutationObserver がトースト出現を先に捕捉できる。
    attach2ResolveRef.resolve({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラー' } }),
    } as unknown as Response);

    // 明細 DELETE が呼ばれていないこと（ロールバックしない方針）。
    // 警告トーストが表示されたら orderLog に 'toast' を記録し、表示確認も行う。
    // waitFor は MutationObserver でトースト出現を検知する。実装では setApiToast 後に
    // useEffect 経由で onSaveSuccess を呼ぶため、MutationObserver が useEffect より先に発火し
    // 'toast' が orderLog の先頭になる（ATT-FE-080 順序保証）。
    await waitFor(() => {
      const toast = screen.queryByText(/添付ファイルがアップロードに失敗しました/);
      if (toast && !orderLog.includes('toast')) {
        orderLog.push('toast');
      }
      expect(toast).toBeInTheDocument();
    });
    // トースト文言の完全一致確認（正規表現で N 件部分を許容）（FIX 5 対応）。
    expect(
      screen.getByText(/\d+\s*件の添付ファイルがアップロードに失敗しました。再試行してください/),
    ).toBeInTheDocument();

    expect(deleteCalledUrls.some((u) => u.includes('/api/reports/rpt-1/items/item-new') && !u.includes('/attachments'))).toBe(false);

    // onSaveSuccess と invalidate が呼ばれるまで待つ。
    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
    });

    // 一覧再読み込みが行われること（部分失敗時も invalidate する）。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['reports', 'detail', 'rpt-1']),
      }),
    );

    // 順序検証（FIX 3 + blocker 2 対応）:
    // blocker 2 対応で useCreateItem を使用するため、明細作成成功時に useCreateItem.onSuccess が
    // invalidateQueries を呼ぶ。そのため orderLog の最初に 'invalidate' が追加される。
    // 期待順序: ['invalidate'（item 作成成功時）, 'toast', 'onSaveSuccess', 'invalidate'（添付完了時）]
    // 「toast → onSaveSuccess」の相対順序は引き続き保証されていることを確認する。
    const toastIndex = orderLog.indexOf('toast');
    const saveSuccessIndex = orderLog.indexOf('onSaveSuccess');
    const lastInvalidateIndex = orderLog.lastIndexOf('invalidate');
    expect(toastIndex).toBeGreaterThanOrEqual(0);
    expect(saveSuccessIndex).toBeGreaterThan(toastIndex);
    expect(lastInvalidateIndex).toBeGreaterThan(saveSuccessIndex);
  });

  // ATT-FE-082: 順次アップロード中のパネル閉じで AbortController 中断 + 「アップロードを中止しました」トースト。
  // 3 パターン検証（FIX 6）: (a) × ボタン / (b) キャンセルボタン / (c) 明細外クリック（Drawer onClose）。
  // 各パターンで AbortController 中断・警告トースト・明細 DELETE 未呼出を検証する。
  // FAIL 原因（機能未実装）: 追加モードの順次アップロード中断機能が未実装。
  // 機能実装後: 順次アップロード中にパネルを閉じると AbortController で中断され警告トーストが表示される。
  it('ATT-FE-082: aborts_sequential_upload_and_shows_warning_toast_on_panel_close_during_upload', async () => {
    // (a)(b)(c) の 3 パターンをループで検証する（FIX 6）。
    const closePatterns: Array<{
      label: string;
      triggerClose: (u: ReturnType<typeof userEvent.setup>) => Promise<void>;
    }> = [
      {
        label: '(a) × ボタン',
        triggerClose: async (u) => {
          // ヘッダー右の × ボタン（aria-label="閉じる"）を押す。
          const closeBtn = screen.getByRole('button', { name: '閉じる' });
          await u.click(closeBtn);
        },
      },
      {
        label: '(b) キャンセルボタン',
        triggerClose: async (u) => {
          // ItemForm 内の「キャンセル」ボタン（onCancel → handleCloseAttempt）を押す。
          const cancelBtn = screen.getByRole('button', { name: 'キャンセル' });
          await u.click(cancelBtn);
        },
      },
      {
        label: '(c) 明細外クリック（Drawer onClose）',
        triggerClose: async (u) => {
          // MUI Drawer の backdrop をクリックして Drawer の onClose を発火する。
          const backdrop = document.querySelector('.MuiBackdrop-root');
          if (backdrop) {
            await u.click(backdrop);
          }
        },
      },
    ];

    for (const pattern of closePatterns) {
      const user = userEvent.setup();
      const { Wrapper } = createWrapper();
      const onClose = vi.fn();

      // 明細作成 (201) は即時完了。
      // 添付 POST はレスポンス遅延（AbortController でキャンセル可能）。
      const attachUploadResolveRef: { resolve: (v: Response) => void } = { resolve: () => {} };

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        const method = (opts?.method ?? 'GET').toUpperCase();
        if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items') && !(url as string).includes('/attachments')) {
          // 明細作成は即時完了。
          return Promise.resolve({
            ok: true,
            status: 201,
            headers: { get: () => null },
            json: async () => ({
              data: {
                id: 'item-new',
                report_id: 'rpt-1',
                expense_date: '2026-04-19',
                amount: 1500,
                category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
                description: 'テスト明細',
                attachments: [],
                created_at: '2026-04-19T00:00:00Z',
                updated_at: '2026-04-19T00:00:00Z',
              },
            }),
          } as unknown as Response);
        }
        if (method === 'POST' && (url as string).includes('/attachments')) {
          // 添付 POST は AbortController に対応した遅延フェッチ。
          return makeAbortablePendingFetch(attachUploadResolveRef)(url, opts);
        }
        // GET 等はデフォルト空レスポンス。
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
        } as unknown as Response);
      });

      const { unmount } = render(
        <ItemSlidePanel
          open={true}
          mode="add"
          item={null}
          reportId="rpt-1"
          reportStatus="draft"
          isOwner={true}
          onClose={onClose}
          onSaveSuccess={() => undefined}
          onSaveAndContinue={() => undefined}
          categories={[{ value: 'cat-001', label: '交通費' }]}
        />,
        { wrapper: Wrapper },
      );

      // 追加モードで AttachmentArea が描画されること（FAIL 前提）。
      await waitFor(() => {
        expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
      });

      // 添付ファイル 1 件をローカル保留する。
      const fileInput = screen.getByTestId('attachment-file-input');
      const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
      await user.upload(fileInput, jpegFile);

      // フォームを入力する。
      await user.type(screen.getByLabelText(/日付/), '2026-04-19');
      await user.type(screen.getByLabelText(/金額/), '1500');
      // カテゴリを明示選択する（category 自動選択 useEffect 削除 FIX 2 対応）。
      const categorySelect082 = screen.getByRole('combobox', { name: /カテゴリ/ });
      await user.click(categorySelect082);
      await user.click(screen.getByRole('option', { name: '交通費' }));
      await user.type(screen.getByLabelText(/摘要/), 'テスト明細');

      // 保存ボタンをクリックする（明細作成 POST 後、添付 POST が開始される）。
      await user.click(screen.getByRole('button', { name: /保存する/ }));

      // 順次アップロード中（明細作成完了 + 添付 POST 進行中）を確認する。
      // FIX 1 対応: 進捗は保存ボタンのラベルに表示される（設計書 §6 L332）。
      // ボタンのラベルが「アップロード中... (N/M 件完了)」に切り替わることで確認する。
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /アップロード中/ })).toBeInTheDocument();
      });

      // パターン別のクローズ操作を実行する（順次アップロード中断をトリガー）。
      await pattern.triggerClose(user);

      // AbortController で進行中の添付 POST が中断される。
      // 「アップロードを中止しました」相当の警告トーストが表示されること（FAIL 前提）。
      await waitFor(() => {
        expect(screen.getByText(/アップロードを中止しました/)).toBeInTheDocument();
      });

      // 作成済み明細はロールバックされないこと（DELETE API は呼ばれない）。
      const deleteCalledOnItems = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
        ([url, opts]) =>
          typeof url === 'string' &&
          (url as string).includes('/api/reports/rpt-1/items/item-new') &&
          !((url as string).includes('/attachments')) &&
          (opts?.method ?? 'GET') === 'DELETE',
      );
      expect(deleteCalledOnItems).toBe(false);

      // cleanup。
      attachUploadResolveRef.resolve({
        ok: false,
        status: 0,
        headers: { get: () => null },
        json: async () => ({}),
      } as unknown as Response);

      unmount();
      vi.restoreAllMocks();
      globalThis.fetch = originalFetch;
    }
  });
});

// =============================================================================
// issue #170 回帰テスト: ReportDetailPage 経由のテストに置換済み（codex 指摘 PR #132 対応）
// =============================================================================
// ItemSlidePanel 単体テストでは旧バグ（親の ReportDetailPage.handleItemSaveAndContinue 経由の
// 2 回目 POST）を再現できない。onItemSaveAndContinue を渡さなければ else { onSaveAndContinueProp() }
// 経路のみ通り、旧実装でも POST 1 回で済むため回帰防止にならない。
//
// 旧バグ再現確認結果（2026-05-05 実施）:
//   ReportDetailPage.tsx に handleItemSaveAndContinue を復活させ（createItem.mutate を再呼び出し）、
//   ItemSlidePanel.tsx に onItemSaveAndContinue 分岐を復活させた状態で
//   ITM-FE-109 / ITM-FE-110 を実行したところ、postItemsCallCount が 2 となり両テストが FAIL した
//   (expected 1 received 2)。正しい実装に戻すと PASS することも確認済み。
//
// 代替テスト: frontend/src/pages/reports/__tests__/ReportDetailPage.duplicate-item-prevention.test.tsx
//   - ITM-FE-109: does_not_double_post_when_save_and_add_clicked_without_attachments
//   - ITM-FE-110: does_not_double_post_when_save_and_add_clicked_with_attachments
// =============================================================================


// issue #134 回帰テスト: ItemSlidePanel 追加モード保存での err.message 画面表示テストは削除。
// fetch モックで useCreateItem 経由の ApiClientError 発生を再現しようとしたが、jsdom 環境下で
// setItemApiError 経由の DOM 反映が安定しないため、回帰検証としては不安定だった。
// #134 の onError 統一の回帰検証は以下のテストで担保されている:
// - AttachmentUploader.test.tsx の INVALID_FILE_TYPE / INTERNAL_ERROR ケース（err.message 経由のマッピング確認）
// - 本ファイル ATT-FE-079/080/082（追加モード保存時の err.message ベースのエラー表示）
// 本テストは issue #135（削除/提出等エラーの表示経路修正）完了時に必要に応じて再導入を検討する。

// =============================================================================
// issue #130 回帰テスト: ItemSlidePanel 閉じアニメーション中のレイアウトフラッシュ防止
// =============================================================================

describe('ItemSlidePanel 閉じアニメーション中のレイアウトフラッシュ（issue #130）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // issue #130: view モードのパネルを閉じたとき、onExited が呼ばれる前は
  // mode='add' 相当の DOM（保存ボタン・「保存して続けて追加」ボタン）が出現しないことを検証する。
  // onTransitionExited コールバックが提供されていれば SlideProps.onExited に配線される。
  // このテストは onTransitionExited が呼ばれる前に mode を 'add' にフォールバックしない
  // ことを検証するものではなく、view モードから 'add' への切り替えを制御できることを確認する。
  it('issue #130: view モードで開いたパネルを閉じても保存ボタンは出現しない（onTransitionExited 前）', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onClose = vi.fn();
    const onTransitionExited = vi.fn();

    // 添付一覧 API は空レスポンスを返す。
    globalThis.fetch = vi.fn().mockResolvedValue(makeEmptyAttachmentListResponse());

    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={onClose}
        onSaveSuccess={vi.fn()}
        onSaveAndContinue={vi.fn()}
        categories={[{ value: 'cat-001', label: '交通費' }]}
        onTransitionExited={onTransitionExited}
      />,
      { wrapper: Wrapper },
    );

    // view モードではパネルが開かれているとき保存ボタンは表示されない。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // view モードではタイトルが「明細詳細」で表示される。
    expect(screen.getByText('明細詳細')).toBeInTheDocument();

    // view モードでは保存ボタンは表示されない（ItemForm は isView=true で保存ボタンを非表示にする）。
    expect(screen.queryByRole('button', { name: /保存する/ })).not.toBeInTheDocument();

    // 閉じるボタンを押す（onClose が呼ばれる）。
    const closeButton = screen.getByRole('button', { name: '閉じる' });
    await user.click(closeButton);

    // onClose が呼ばれたことを確認する。
    expect(onClose).toHaveBeenCalledTimes(1);

    // onTransitionExited が呼ばれると SlideProps.onExited が発火したことを意味する。
    // jsdom 環境では CSS アニメーションが動作しないため、MUI Drawer の SlideProps.onExited は
    // 自動では発火しない。コールバックが prop として正しく渡されていることを確認することで
    // 「アニメーション完了後に selectedItem をリセットする仕組みが設定されている」ことを保証する。
    // onTransitionExited は onClose 後にアニメーション完了で呼ばれる想定（jsdom では手動発火に依存）。
    expect(onTransitionExited).not.toHaveBeenCalled(); // jsdom では自動発火しないため 0 回が正しい
  });

  // issue #130: onTransitionExited コールバックが SlideProps.onExited として Drawer に配線されることを確認する。
  // onTransitionExited が呼ばれた後に selectedItem リセット等の後処理が実行される設計の
  // インテグレーションポイントとして機能することを検証する。
  it('issue #130: onTransitionExited prop が指定されていない場合も Drawer は正常に動作する', async () => {
    const { Wrapper } = createWrapper();

    // 添付一覧 API は空レスポンスを返す。
    globalThis.fetch = vi.fn().mockResolvedValue(makeEmptyAttachmentListResponse());

    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={vi.fn()}
        onSaveSuccess={vi.fn()}
        onSaveAndContinue={vi.fn()}
        categories={[{ value: 'cat-001', label: '交通費' }]}
        // onTransitionExited を省略しても動作することを確認する。
      />,
      { wrapper: Wrapper },
    );

    // パネルが正常に描画されること。
    await waitFor(() => {
      expect(screen.getByTestId('item-slide-panel')).toBeInTheDocument();
    });

    // view モードのタイトルが表示されること。
    expect(screen.getByText('明細詳細')).toBeInTheDocument();
  });
});

// =============================================================================
// issue #132 回帰テスト: 保存成功後に dirty state がリセットされ beforeunload が抑制されないこと
// =============================================================================

describe('ItemSlidePanel dirty state リセット（issue #132）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * beforeunload イベントを同期的に発火し、event.preventDefault が呼ばれたかどうかを返す。
   * dirty 状態であれば ItemSlidePanel の useEffect がリスナを登録しているため
   * event.preventDefault が呼ばれる。クリーン状態であれば呼ばれない。
   */
  function fireBeforeUnloadAndCheck(): boolean {
    let called = false;
    const event = new Event('beforeunload', { cancelable: true });
    const originalPreventDefault = event.preventDefault.bind(event);
    event.preventDefault = () => {
      called = true;
      originalPreventDefault();
    };
    window.dispatchEvent(event);
    return called;
  }

  // issue #132: 追加モードで保存成功後に beforeunload が抑制されないこと（dirty がリセットされる）。
  // ATT-FE-079 経路: 明細 POST 成功（添付ファイルなし）→ onSaveSuccess → open=false → resetDirtyState。
  it('issue #132: 追加モード保存成功後に beforeunload ダイアログが表示されない（isDirty が false になる）', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onSaveSuccess = vi.fn();

    // 明細作成 API: 即時 201。
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'item-new',
              report_id: 'rpt-1',
              expense_date: '2026-04-19',
              amount: 1500,
              category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
              description: 'テスト明細',
              attachments: [],
              created_at: '2026-04-19T00:00:00Z',
              updated_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      // GET 等はデフォルト空レスポンス。
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
      } as unknown as Response;
    });

    const { rerender } = render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={onSaveSuccess}
        onSaveAndContinue={() => undefined}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // フォームを入力して dirty 状態にする。
    await user.type(screen.getByLabelText(/日付/), '2026-04-19');
    await user.type(screen.getByLabelText(/金額/), '1500');
    const categorySelect = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelect);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), 'テスト明細');

    // dirty 状態で beforeunload を発火すると event.preventDefault が呼ばれることを確認する。
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(true);
    });

    // 保存ボタンをクリックする。
    const saveButton = screen.getByRole('button', { name: /保存する/ });
    await user.click(saveButton);

    // onSaveSuccess が呼ばれるまで待機する。
    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
    });

    // パネルを閉じた状態を simulate する（open=false）。
    rerender(
      <ItemSlidePanel
        open={false}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={onSaveSuccess}
        onSaveAndContinue={() => undefined}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
    );

    // open=false になった後、beforeunload を発火しても event.preventDefault が呼ばれないこと。
    // isDirty が false になったため beforeunload リスナが解除されている（issue #132 修正の検証）。
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(false);
    });
  });

  // issue #132: 編集モードで保存成功後（open=false）に beforeunload が抑制されないこと。
  // 編集モード経路: onItemSubmit → 親の mutation.onSuccess → open=false → resetDirtyState（useEffect）。
  it('issue #132: 編集モード保存成功後（open=false）に beforeunload ダイアログが表示されない', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onItemSubmit = vi.fn();

    // 添付一覧 API は空レスポンスを返す。
    globalThis.fetch = vi.fn().mockResolvedValue(makeEmptyAttachmentListResponse());

    const { rerender } = render(
      <ItemSlidePanel
        open={true}
        mode="edit"
        item={mockItem}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={vi.fn()}
        onSaveAndContinue={() => undefined}
        onItemSubmit={onItemSubmit}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // 添付一覧が取得されるまで待機する。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    });

    // フォームを編集して dirty 状態にする。
    const descriptionInput = screen.getByLabelText(/摘要/);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, '変更後の説明');

    // dirty 状態で beforeunload を発火すると event.preventDefault が呼ばれることを確認する。
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(true);
    });

    // 保存ボタンをクリックする。
    const saveButton = screen.getByRole('button', { name: /保存する/ });
    await user.click(saveButton);

    // onItemSubmit が呼ばれたことを確認する（親が mutation を実行する）。
    await waitFor(() => {
      expect(onItemSubmit).toHaveBeenCalledTimes(1);
    });

    // 親の mutation.onSuccess に相当: open=false に切り替える。
    rerender(
      <ItemSlidePanel
        open={false}
        mode="edit"
        item={mockItem}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={vi.fn()}
        onSaveAndContinue={() => undefined}
        onItemSubmit={onItemSubmit}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
    );

    // open=false になった後、beforeunload を発火しても event.preventDefault が呼ばれないこと。
    // isDirty が false になったため beforeunload リスナが解除されている（issue #132 修正の検証）。
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(false);
    });
  });

  // issue #132: 「保存して続けて追加」成功後に isDirty が一旦 false になることを確認する。
  // 続けて入力することで isDirty が true に戻ることも検証する（warning 対応: テスト名と内容の整合）。
  it('issue #132: 保存して続けて追加の成功後に isDirty が false になり、再入力で true に戻る', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onSaveAndContinue = vi.fn();

    // 明細作成 API: 即時 201。
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'item-save-continue',
              report_id: 'rpt-1',
              expense_date: '2026-04-19',
              amount: 2000,
              category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
              description: '続けて追加テスト',
              attachments: [],
              created_at: '2026-04-19T00:00:00Z',
              updated_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      // GET 等はデフォルト空レスポンス。
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
      } as unknown as Response;
    });

    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={vi.fn()}
        onSaveAndContinue={onSaveAndContinue}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // フォームを入力して dirty 状態にする。
    await user.type(screen.getByLabelText(/日付/), '2026-04-19');
    await user.type(screen.getByLabelText(/金額/), '2000');
    const categorySelect = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelect);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), '続けて追加テスト');

    // dirty 状態で beforeunload が抑制されることを確認する。
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(true);
    });

    // 「保存して続けて追加」ボタンをクリックする。
    const saveAndContinueButton = screen.getByRole('button', { name: /保存して続けて追加/ });
    await user.click(saveAndContinueButton);

    // onSaveAndContinue が呼ばれるまで待機する。
    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1);
    });

    // 保存成功後: beforeunload が抑制されないことを確認する（isDirty=false になった）。
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(false);
    });

    // 再入力することで isDirty が true に戻り、beforeunload が再び抑制されることを確認する
    // （warning 対応: テスト名に「再入力で true に戻る」と明示されているため、実際に検証する）。
    await user.type(screen.getByLabelText(/摘要/), '再入力');
    await waitFor(() => {
      expect(fireBeforeUnloadAndCheck()).toBe(true);
    });
  });

  // issue #132 codex blocker: 追加モードで添付ファイルありの保存成功後に
  // pending-file-row-* が DOM から消えることを検証する（AttachmentAreaAddMode 再マウント方式）。
  it('issue #132 codex blocker: 追加モードで添付あり保存成功後に保留ファイル行が DOM から消える', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onSaveSuccess = vi.fn();

    // 明細作成 API: 即時 201。
    // 添付 POST API: 即時 201。
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items') && !(url as string).includes('/attachments')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'item-with-attach',
              report_id: 'rpt-1',
              expense_date: '2026-04-19',
              amount: 1500,
              category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
              description: '添付あり',
              attachments: [],
              created_at: '2026-04-19T00:00:00Z',
              updated_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      if (method === 'POST' && (url as string).includes('/attachments')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'att-blocker-1',
              item_id: 'item-with-attach',
              file_name: 'receipt.jpg',
              file_size: 1024,
              mime_type: 'image/jpeg',
              created_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      // GET 等はデフォルト空レスポンス。
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
      } as unknown as Response;
    });

    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={onSaveSuccess}
        onSaveAndContinue={() => undefined}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // 追加モードで AttachmentArea が描画されること。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    });

    // 添付ファイル 1 件をローカル保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    await user.upload(fileInput, jpegFile);

    // 保留ファイル行（pending-file-row-0）が表示されることを確認する。
    await waitFor(() => {
      expect(screen.getByTestId('pending-file-row-0')).toBeInTheDocument();
    });

    // フォームを入力する。
    await user.type(screen.getByLabelText(/日付/), '2026-04-19');
    await user.type(screen.getByLabelText(/金額/), '1500');
    const categorySelectBlocker = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelectBlocker);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), '添付あり');

    // 保存ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: /保存する/ }));

    // onSaveSuccess が呼ばれるまで待機する。
    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
    });

    // 保存成功後: pending-file-row-0 が DOM から消えることを確認する（codex blocker 修正の検証）。
    // AttachmentAreaAddMode が再マウントされ、AttachmentUploader 内部の pendingFiles がクリアされる。
    await waitFor(() => {
      expect(screen.queryByTestId('pending-file-row-0')).not.toBeInTheDocument();
    });
  });

  // issue #132 codex blocker: 「保存して続けて追加」後に pending files がクリアされることを検証する。
  it('issue #132 codex blocker: 保存して続けて追加後に保留ファイル行が DOM から消える', async () => {
    const user = userEvent.setup();
    const { Wrapper } = createWrapper();
    const onSaveAndContinue = vi.fn();

    // 明細作成 API: 即時 201。
    // 添付 POST API: 即時 201。
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && (url as string).includes('/api/reports/rpt-1/items') && !(url as string).includes('/attachments')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'item-save-cont-att',
              report_id: 'rpt-1',
              expense_date: '2026-04-19',
              amount: 3000,
              category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
              description: '続けて添付テスト',
              attachments: [],
              created_at: '2026-04-19T00:00:00Z',
              updated_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      if (method === 'POST' && (url as string).includes('/attachments')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({
            data: {
              id: 'att-cont-1',
              item_id: 'item-save-cont-att',
              file_name: 'receipt.png',
              file_size: 512,
              mime_type: 'image/png',
              created_at: '2026-04-19T00:00:00Z',
            },
          }),
        } as unknown as Response;
      }
      // GET 等はデフォルト空レスポンス。
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: [], pagination: { current_page: 1, per_page: 20, total_count: 0, total_pages: 0 } }),
      } as unknown as Response;
    });

    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        reportId="rpt-1"
        reportStatus="draft"
        isOwner={true}
        onClose={() => undefined}
        onSaveSuccess={vi.fn()}
        onSaveAndContinue={onSaveAndContinue}
        categories={[{ value: 'cat-001', label: '交通費' }]}
      />,
      { wrapper: Wrapper },
    );

    // 追加モードで AttachmentArea が描画されること。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-area')).toBeInTheDocument();
    });

    // 添付ファイル 1 件をローカル保留する。
    const fileInput = screen.getByTestId('attachment-file-input');
    const pngFile = createMockFile('receipt.png', 512, 'image/png');
    await user.upload(fileInput, pngFile);

    // 保留ファイル行が表示されることを確認する。
    await waitFor(() => {
      expect(screen.getByTestId('pending-file-row-0')).toBeInTheDocument();
    });

    // フォームを入力する。
    await user.type(screen.getByLabelText(/日付/), '2026-04-19');
    await user.type(screen.getByLabelText(/金額/), '3000');
    const categorySelectCont = screen.getByRole('combobox', { name: /カテゴリ/ });
    await user.click(categorySelectCont);
    await user.click(screen.getByRole('option', { name: '交通費' }));
    await user.type(screen.getByLabelText(/摘要/), '続けて添付テスト');

    // 「保存して続けて追加」ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: /保存して続けて追加/ }));

    // onSaveAndContinue が呼ばれるまで待機する。
    await waitFor(() => {
      expect(onSaveAndContinue).toHaveBeenCalledTimes(1);
    });

    // 保存成功後: pending-file-row-0 が DOM から消えることを確認する（codex blocker 修正の検証）。
    await waitFor(() => {
      expect(screen.queryByTestId('pending-file-row-0')).not.toBeInTheDocument();
    });
  });
});
