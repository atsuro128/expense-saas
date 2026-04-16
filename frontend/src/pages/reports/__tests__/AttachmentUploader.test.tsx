// AttachmentUploader コンポーネントのユニットテスト。
// report-detail.md §AttachmentUploader の Props 仕様に基づくテスト。
// ATT-FE-016〜028 に対応する。
// issue-100 修正対応: CircularProgress 表示・VisuallyHiddenInput・DnD 視覚フィードバックのテストを追加。

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttachmentUploader from '../AttachmentUploader';

// テスト用ファイルオブジェクト生成ヘルパー。
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

/** テスト用の QueryClient を生成するヘルパー。リトライを無効化してテストを安定させる。 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** AttachmentUploader を QueryClientProvider でラップして描画するヘルパー。 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('AttachmentUploader', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-016: isPending=false のとき「ファイルを追加」ボタンが表示される。
  // issue-100: ボタン文言を「ファイルを追加」に変更（AddIcon が「+」を担う）。
  it('ATT-FE-016: アップロード中でないとき「ファイルを追加」テキストが表示される', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('ファイルを追加');
  });

  // ATT-FE-017: アップロード中のとき「アップロード中...」テキストが表示される（Hook の isPending に基づく）。
  it('ATT-FE-017: アップロード中のとき「アップロード中...」テキストが表示される', async () => {
    const onUploadSuccess = vi.fn();
    // fetch を遅延させてアップロード中状態を再現する。
    let resolveFetch!: () => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = () =>
          resolve({
            ok: true,
            status: 201,
            headers: { get: () => null },
            json: async () => ({
              data: {
                id: 'att-new',
                item_id: 'item-001',
                file_name: 'receipt.jpg',
                file_size: 1024,
                mime_type: 'image/jpeg',
                created_at: '2026-04-01T00:00:00Z',
              },
            }),
          } as unknown as Response);
      }),
    );

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // アップロード中は「アップロード中...」テキストが表示されること。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('アップロード中...');
    });

    // fetch の解決を待つ。
    resolveFetch();
  });

  // ATT-FE-018: JPEG ファイルを選択するとクライアントサイドバリデーションを通過し、mutate が呼ばれる。
  it('ATT-FE-018: JPEG ファイルを選択すると useUploadAttachment の mutate が呼ばれる', async () => {
    const onUploadSuccess = vi.fn();
    // アップロード API モック
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-new',
          item_id: 'item-001',
          file_name: 'receipt.jpg',
          file_size: 1024,
          mime_type: 'image/jpeg',
          created_at: '2026-04-01T00:00:00Z',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');

    // ファイル選択イベントを発火する
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // JPEG は許可形式のため mutate が呼ばれ、最終的に fetch（アップロードAPI）が呼ばれること
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  // ATT-FE-019: PNG ファイルを選択するとクライアントサイドバリデーションを通過し、mutate が呼ばれる。
  it('ATT-FE-019: PNG ファイルを選択すると useUploadAttachment の mutate が呼ばれる', async () => {
    const onUploadSuccess = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-new',
          item_id: 'item-001',
          file_name: 'receipt.png',
          file_size: 1024,
          mime_type: 'image/png',
          created_at: '2026-04-01T00:00:00Z',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const pngFile = createMockFile('receipt.png', 1024, 'image/png');

    fireEvent.change(fileInput, { target: { files: [pngFile] } });

    // PNG は許可形式のため mutate が呼ばれること
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  // ATT-FE-020: PDF ファイルを選択するとクライアントサイドバリデーションを通過し、mutate が呼ばれる。
  it('ATT-FE-020: PDF ファイルを選択すると useUploadAttachment の mutate が呼ばれる', async () => {
    const onUploadSuccess = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-new',
          item_id: 'item-001',
          file_name: 'invoice.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          created_at: '2026-04-01T00:00:00Z',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const pdfFile = createMockFile('invoice.pdf', 1024, 'application/pdf');

    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    // PDF は許可形式のため mutate が呼ばれること
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  // ATT-FE-021: GIF ファイルを選択するとバリデーションエラーメッセージが表示される。
  it('ATT-FE-021: GIF ファイルを選択するとバリデーションエラーが表示される', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const gifFile = createMockFile('animation.gif', 1024, 'image/gif');

    fireEvent.change(fileInput, { target: { files: [gifFile] } });

    // GIF は許可リスト外のためバリデーションエラーメッセージが表示されること
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-022: テキストファイルを選択するとバリデーションエラーメッセージが表示される。
  it('ATT-FE-022: TXT ファイルを選択するとバリデーションエラーが表示される', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const txtFile = createMockFile('notes.txt', 1024, 'text/plain');

    fireEvent.change(fileInput, { target: { files: [txtFile] } });

    // テキストファイルは許可リスト外のためバリデーションエラーメッセージが表示されること
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-023: 5MB + 1B のファイルを選択するとバリデーションエラーが表示される。
  it('ATT-FE-023: 5MB 超過ファイルを選択するとバリデーションエラーが表示される（境界値）', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // 5MB + 1B のファイル（境界値超過）
    const tooLargeFile = createMockFile('large.jpg', 5242881, 'image/jpeg');
    expect(tooLargeFile.size).toBe(5242881);
    expect(tooLargeFile.size).toBeGreaterThan(5 * 1024 * 1024);

    fireEvent.change(fileInput, { target: { files: [tooLargeFile] } });

    // サイズ超過のためバリデーションエラーメッセージが表示されること
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-024: 5MB ちょうどのファイルは許可される（境界値）。
  it('ATT-FE-024: 5MB ちょうどのファイルはバリデーション通過し mutate が呼ばれる（境界値）', async () => {
    const onUploadSuccess = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-new',
          item_id: 'item-001',
          file_name: 'exactly5mb.jpg',
          file_size: 5242880,
          mime_type: 'image/jpeg',
          created_at: '2026-04-01T00:00:00Z',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // ちょうど 5MB のファイル（境界値・許可）
    const exactlyMaxFile = createMockFile('exactly5mb.jpg', 5242880, 'image/jpeg');
    expect(exactlyMaxFile.size).toBe(5242880);
    expect(exactlyMaxFile.size).toBe(5 * 1024 * 1024);

    fireEvent.change(fileInput, { target: { files: [exactlyMaxFile] } });

    // ちょうど 5MB はバリデーション通過のため mutate が呼ばれ fetch が実行されること
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // バリデーションエラーが表示されないこと
    expect(screen.queryByTestId('attachment-validation-error')).toBeNull();
  });

  // ATT-FE-025: ドラッグ&ドロップで有効なファイルを受け付け、mutate が呼ばれる。
  it('ATT-FE-025: ドロップゾーンへの JPEG ドラッグ&ドロップで mutate が呼ばれる', async () => {
    const onUploadSuccess = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-new',
          item_id: 'item-001',
          file_name: 'receipt.jpg',
          file_size: 1024,
          mime_type: 'image/jpeg',
          created_at: '2026-04-01T00:00:00Z',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const uploader = screen.getByTestId('attachment-uploader');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');

    // ドロップイベントを発火する
    fireEvent.drop(uploader, {
      dataTransfer: {
        files: [jpegFile],
        types: ['Files'],
      },
    });

    // JPEG は許可形式のため drop 後に mutate が呼ばれ fetch が実行されること
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  // ATT-FE-026: ドラッグ&ドロップで無効なファイル（GIF）を受け付けるとエラーが表示される。
  it('ATT-FE-026: ドロップゾーンへの GIF ドロップでバリデーションエラーが表示される', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const uploader = screen.getByTestId('attachment-uploader');
    const gifFile = createMockFile('animation.gif', 1024, 'image/gif');

    // GIF ファイルをドロップする
    fireEvent.drop(uploader, {
      dataTransfer: {
        files: [gifFile],
        types: ['Files'],
      },
    });

    // GIF は許可リスト外のためバリデーションエラーが表示されること
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-027: アップロード成功後に onUploadSuccess コールバックが呼ばれる。
  it('ATT-FE-027: アップロード成功後に onUploadSuccess コールバックが呼ばれる', async () => {
    const onUploadSuccess = vi.fn();
    // アップロード成功モック
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({
        data: {
          id: 'att-new',
          item_id: 'item-001',
          file_name: 'receipt.jpg',
          file_size: 1024,
          mime_type: 'image/jpeg',
          created_at: '2026-04-01T00:00:00Z',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="rpt-1"
        itemId="item-1"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // アップロード成功後に onUploadSuccess が呼ばれること
    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ATT-FE-028: アップロード中のときファイル入力と「ファイルを追加」ボタンが disabled になる。
  // Hook の isPending が true の間は disabled になること（ATT-FE-017 でカバー済み）。
  it('ATT-FE-028: アップロード中のときファイル入力が disabled になる', async () => {
    const onUploadSuccess = vi.fn();
    // fetch を遅延させてアップロード中状態を維持する。
    let resolveFetch!: () => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = () =>
          resolve({
            ok: true,
            status: 201,
            headers: { get: () => null },
            json: async () => ({
              data: {
                id: 'att-new',
                item_id: 'item-001',
                file_name: 'receipt.jpg',
                file_size: 1024,
                mime_type: 'image/jpeg',
                created_at: '2026-04-01T00:00:00Z',
              },
            }),
          } as unknown as Response);
      }),
    );

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // アップロード中は input が disabled になること。
    await waitFor(() => {
      expect(screen.getByTestId('attachment-file-input')).toBeDisabled();
      expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('アップロード中...');
    });

    // fetch の解決を待つ。
    resolveFetch();
  });

  // ATT-FE-029: isPending=true のとき CircularProgress がボタン内に表示される（issue-100 SMK-012 対応）。
  it('ATT-FE-029: アップロード中のとき CircularProgress がボタン内に表示される', async () => {
    const onUploadSuccess = vi.fn();
    // fetch を遅延させてアップロード中状態を維持する。
    let resolveFetch!: () => void;
    globalThis.fetch = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = () =>
          resolve({
            ok: true,
            status: 201,
            headers: { get: () => null },
            json: async () => ({
              data: {
                id: 'att-new',
                item_id: 'item-001',
                file_name: 'receipt.jpg',
                file_size: 1024,
                mime_type: 'image/jpeg',
                created_at: '2026-04-01T00:00:00Z',
              },
            }),
          } as unknown as Response);
      }),
    );

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // アップロード中は CircularProgress（role="progressbar"）がボタン内に表示されること。
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // fetch の解決を待つ。
    resolveFetch();
  });

  // ATT-FE-030: visually-hidden な input が 1 つだけ DOM に存在する（issue-100 重複ボタン解消確認）。
  it('ATT-FE-030: visually-hidden な file input が 1 つだけ DOM に存在する', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    // attachment-file-input の data-testid を持つ input が 1 つだけ存在すること。
    const fileInputs = screen.getAllByTestId('attachment-file-input');
    expect(fileInputs).toHaveLength(1);
    expect(fileInputs[0]).toHaveAttribute('type', 'file');

    // ボタン（attachment-upload-button）が 1 つだけ存在すること。
    const buttons = screen.getAllByTestId('attachment-upload-button');
    expect(buttons).toHaveLength(1);
  });

  // ATT-FE-031: dragover 時にドロップゾーンの data-drag-over 属性が true になる（視覚フィードバック確認）。
  it('ATT-FE-031: dragover 時にドロップゾーンの data-drag-over 属性が true になる', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const dropZone = screen.getByTestId('attachment-drop-zone');

    // 初期状態では data-drag-over が false であること。
    expect(dropZone).toHaveAttribute('data-drag-over', 'false');

    // dragover イベントを発火する。
    fireEvent.dragOver(dropZone);

    // dragover 中は data-drag-over が true になること（視覚フィードバック）。
    expect(dropZone).toHaveAttribute('data-drag-over', 'true');

    // dragleave イベントを発火する。
    fireEvent.dragLeave(dropZone);

    // dragleave 後は data-drag-over が false に戻ること。
    expect(dropZone).toHaveAttribute('data-drag-over', 'false');
  });
});
