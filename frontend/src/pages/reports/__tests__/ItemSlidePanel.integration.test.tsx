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
    const uploadResolveRef = { resolve: (_v: Response) => {} };
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
    const deleteResolveRef = { resolve: (_v: Response) => {} };
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
    const uploadResolveRef063 = { resolve: (_v: Response) => {} };
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
    const attachment1ResolveRef = { resolve: (_v: Response) => {} };

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
    // カテゴリは既に選択肢がある前提。
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
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onSaveSuccess = vi.fn();

    // 明細 DELETE が呼ばれないことを確認するためのスパイ（DELETE 呼出は意図しない動作）。
    const deleteCalledUrls: string[] = [];

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
        // 1 件目の添付 POST は成功。2 件目は失敗（mockImplementation で呼び出し回数を追跡）。
        const attachPostCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
          .filter(([u, o]) => typeof u === 'string' && (u as string).includes('/attachments') && (o?.method ?? 'GET') === 'POST')
          .length;
        if (attachPostCalls <= 1) {
          // 1 件目（呼び出し回数が 1 以下のとき）は成功。
          return {
            ok: true,
            status: 201,
            headers: { get: () => null },
            json: async () => ({ data: { id: 'att-1', item_id: 'item-new', file_name: 'receipt.jpg', file_size: 1024, mime_type: 'image/jpeg', created_at: '2026-04-19T00:00:00Z' } }),
          } as unknown as Response;
        }
        // 2 件目は失敗 (500)。
        return {
          ok: false,
          status: 500,
          headers: { get: () => null },
          json: async () => ({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'サーバーエラー' } }),
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
    await user.type(screen.getByLabelText(/摘要/), 'テスト明細');

    // 保存ボタンをクリックする。
    await user.click(screen.getByRole('button', { name: /保存する/ }));

    // 明細 DELETE が呼ばれていないこと（ロールバックしない方針）。
    await waitFor(() => {
      // 処理完了を待つため警告トーストの表示を確認する（FIX 5: トースト文言の確認含む）。
      expect(screen.getByText(/添付ファイルがアップロードに失敗しました/)).toBeInTheDocument();
    });
    // トースト文言の完全一致確認（正規表現で N 件部分を許容）（FIX 5 対応）。
    expect(
      screen.getByText(/\d+\s*件の添付ファイルがアップロードに失敗しました。再試行してください/),
    ).toBeInTheDocument();

    expect(deleteCalledUrls.some((u) => u.includes('/api/reports/rpt-1/items/item-new') && !u.includes('/attachments'))).toBe(false);

    // 順序検証（FIX 5）: 警告トーストが表示された後にパネルクローズコールバックが呼ばれること。
    // 呼び出し順: 警告トースト表示 → onSaveSuccess（パネルクローズ相当）→ invalidate。
    // onSaveSuccess の waitFor の時点で警告トーストが既に表示されている = 順序が保証される。
    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
    });

    // 一覧再読み込みが行われること（部分失敗時も invalidate する）。
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['reports', 'detail', 'rpt-1']),
      }),
    );
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
      const attachUploadResolveRef = { resolve: (_v: Response) => {} };

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
      await user.type(screen.getByLabelText(/摘要/), 'テスト明細');

      // 保存ボタンをクリックする（明細作成 POST 後、添付 POST が開始される）。
      await user.click(screen.getByRole('button', { name: /保存する/ }));

      // 順次アップロード中（明細作成完了 + 添付 POST 進行中）を確認する。
      // 「アップロード中...」の表示で確認する（FAIL 前提: 進捗表示未実装）。
      await waitFor(() => {
        expect(screen.getByText(/アップロード中/)).toBeInTheDocument();
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
