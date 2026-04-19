// ItemSlidePanel 統合テスト。
// AttachmentArea + ItemSlidePanel の連携を検証する。
// MSW が未インストールのため globalThis.fetch をモックして API 呼び出しをシミュレートする。
// ATT-FE-060, 062, 063 に対応する（issue #108: アップロード/削除中断トースト・明細切替）。
// 機能実装フェーズ（issue #108 対応）で green になる想定（AbortController / 中断トーストが未実装のため FAIL）。

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
