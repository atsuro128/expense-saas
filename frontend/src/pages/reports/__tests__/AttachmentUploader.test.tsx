// AttachmentUploader コンポーネントのユニットテスト。
// report-detail.md §AttachmentUploader の Props 仕様に基づくテスト。
// ATT-FE-016〜028 に対応する。
// issue-100 修正対応: CircularProgress 表示・VisuallyHiddenInput・DnD 視覚フィードバックのテストを追加。
// ATT-FE-073, 074, 078 に対応する（issue #115: 追加モードのローカル保持・バリデーション・編集モード不変）。
// ATT-FE-073, 074 は機能実装前のため FAIL 前提。
// FAIL 原因: AttachmentUploader に mode prop がなく、ローカル保持の分岐が未実装。
// issue #134 回帰テスト: API エラー時に onUploadError 経由でマッピング済みの err.message が伝播すること。
// issue #131 修正: バリデーションエラー文言を smoke_check.md SMK-033/035 に整合、MUI Alert 表示検証を追加。

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ComponentType } from 'react';
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
  // issue #131: 文言を smoke_check.md SMK-033 に整合。MUI Alert（role="alert"）で表示されることを検証。
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

    // GIF は許可リスト外のためバリデーションエラーメッセージが表示されること（SMK-033 整合文言）。
    const errorEl = screen.getByTestId('attachment-validation-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('JPEG, PNG, PDF のみアップロード可能です');
    // MUI Alert が role="alert" を付与していること。
    expect(errorEl).toHaveAttribute('role', 'alert');
  });

  // ATT-FE-022: テキストファイルを選択するとバリデーションエラーメッセージが表示される。
  // issue #131: 文言を smoke_check.md SMK-033 に整合。
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

    // テキストファイルは許可リスト外のためバリデーションエラーメッセージが表示されること（SMK-033 整合文言）。
    const errorEl = screen.getByTestId('attachment-validation-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('JPEG, PNG, PDF のみアップロード可能です');
  });

  // ATT-FE-023: 5MB + 1B のファイルを選択するとバリデーションエラーが表示される。
  // issue #131: 文言を smoke_check.md SMK-035 に整合。MUI Alert の role="alert" も検証。
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

    // サイズ超過のためバリデーションエラーメッセージが表示されること（SMK-035 整合文言）。
    const errorEl = screen.getByTestId('attachment-validation-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('ファイルサイズは5MB以下にしてください');
    // MUI Alert が role="alert" を付与していること。
    expect(errorEl).toHaveAttribute('role', 'alert');
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
  // issue #131: 文言を smoke_check.md SMK-033 に整合。
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

    // GIF は許可リスト外のためバリデーションエラーが表示されること（SMK-033 整合文言）。
    const errorEl = screen.getByTestId('attachment-validation-error');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('JPEG, PNG, PDF のみアップロード可能です');
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

    // アップロード中は DnD でも handleFile が再実行されないこと（ATT-FE-028 要件）。
    const secondFile = createMockFile('second.jpg', 2048, 'image/jpeg');
    fireEvent.drop(screen.getByTestId('attachment-uploader'), {
      dataTransfer: { files: [secondFile], types: ['Files'] },
    });
    // fetch が 1 回目のアップロード分しか呼ばれていないこと。
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // fetch の解決を待つ。
    resolveFetch();
  });

  // ATT-FE-051: isPending=true のとき CircularProgress がボタン内に表示される（issue-100 SMK-012 対応）。
  it('ATT-FE-051: アップロード中のとき CircularProgress がボタン内に表示される', async () => {
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

  // ATT-FE-052: visually-hidden な input が 1 つだけ DOM に存在する（issue-100 重複ボタン解消確認）。
  it('ATT-FE-052: visually-hidden な file input が 1 つだけ DOM に存在する', () => {
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

  // ATT-FE-078: mode='edit' で即時アップロード挙動が不変であることを保証する（issue #115）。
  // 編集モードとの分岐が AttachmentUploader に波及しないことを確認する。
  // mode='edit' で JPEG を選択すると useUploadAttachment.mutate が即時呼ばれ、ローカル state に保留されない。
  // mode prop は機能実装後に AttachmentUploader に追加予定のため @ts-expect-error を付与する。
  // 機能実装で mode prop 型が追加されたら @ts-expect-error を外すこと。
  it('ATT-FE-078: keeps_edit_mode_behavior_unchanged_immediate_upload', async () => {
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

    // mode prop は機能実装後に AttachmentUploader に追加予定。現時点では型定義が存在しない。
    // ComponentType<any> にキャストして mode prop を渡す（機能実装で mode 型が追加されたらキャストを外すこと）。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AttachmentUploaderWithMode = AttachmentUploader as ComponentType<any>;
    renderWithQueryClient(
      <AttachmentUploaderWithMode
        reportId="rpt-1"
        itemId="item-1"
        mode="edit"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = new File([new ArrayBuffer(1024)], 'receipt.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // 編集モードでもファイル選択時点で即時アップロードが行われること（ローカル state に保留されない）。
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // onUploadSuccess が呼ばれること（即時アップロード完了）。
    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ATT-FE-053: dragover 時にドロップゾーンの data-drag-over 属性が true になる（視覚フィードバック確認）。
  it('ATT-FE-053: dragover 時にドロップゾーンの data-drag-over 属性が true になる', () => {
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

// =============================================================================
// issue #131: MUI Alert severity="error" スタイリング検証
// =============================================================================

describe('AttachmentUploader バリデーションエラー UI（issue #131）', () => {
  // SMK-033: MIME エラー時に MUI Alert severity="error" でインライン表示されること。
  // MUI Alert は severity="error" 指定時に MuiAlert-standardError クラスを DOM に付与する。
  it('SMK-033: MIME エラーが MUI Alert severity="error" として表示される', () => {
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

    const errorEl = screen.getByTestId('attachment-validation-error');
    // MUI Alert は role="alert" を付与する。
    expect(errorEl).toHaveAttribute('role', 'alert');
    // MUI Alert severity="error" は MuiAlert-standardError クラスを持つ。
    expect(errorEl.classList.toString()).toMatch(/MuiAlert/);
    // SMK-033 期待文言と完全一致すること。
    expect(errorEl).toHaveTextContent('JPEG, PNG, PDF のみアップロード可能です');
  });

  // SMK-035: サイズエラー時に MUI Alert severity="error" でインライン表示されること。
  it('SMK-035: サイズエラーが MUI Alert severity="error" として表示される', () => {
    const onUploadSuccess = vi.fn();

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // 5MB + 1B のファイル（境界値超過）。
    const tooLargeFile = createMockFile('large.jpg', 5242881, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [tooLargeFile] } });

    const errorEl = screen.getByTestId('attachment-validation-error');
    // MUI Alert は role="alert" を付与する。
    expect(errorEl).toHaveAttribute('role', 'alert');
    // MUI Alert severity="error" は MuiAlert-standardError クラスを持つ。
    expect(errorEl.classList.toString()).toMatch(/MuiAlert/);
    // SMK-035 期待文言と完全一致すること。
    expect(errorEl).toHaveTextContent('ファイルサイズは5MB以下にしてください');
  });
});

// =============================================================================
// issue #134 回帰テスト: onUploadError 経由で err.message が伝播すること
// =============================================================================

describe('AttachmentUploader エラーハンドリング回帰テスト（issue #134）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // issue #134 回帰: API が INVALID_FILE_TYPE エラーを返したとき、
  // onUploadError に「JPEG, PNG, PDF のみアップロード可能です」（SERVER_ERROR_MESSAGES.INVALID_FILE_TYPE）が渡る。
  // client.ts 層でマッピング済みの err.message がそのまま伝播することを確認する。
  it('issue #134: API が INVALID_FILE_TYPE を返したとき onUploadError に SERVER_ERROR_MESSAGES.INVALID_FILE_TYPE のメッセージが渡る', async () => {
    const onUploadError = vi.fn();
    const onUploadSuccess = vi.fn();

    // client.ts の handleErrorResponse が SERVER_ERROR_MESSAGES.INVALID_FILE_TYPE にマッピングして
    // ApiClientError をスローする挙動を fetch モックで再現する。
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // MIME は JPEG だが（クライアント側バリデーションを通過）、サーバー側で INVALID_FILE_TYPE を返す想定。
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // onUploadError に SERVER_ERROR_MESSAGES.INVALID_FILE_TYPE の文言が渡ること。
    await waitFor(() => {
      expect(onUploadError).toHaveBeenCalledWith('JPEG, PNG, PDF のみアップロード可能です');
    });
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });

  // issue #134 回帰: API が INTERNAL_ERROR を返したとき、
  // onUploadError に SERVER_ERROR_MESSAGES.INTERNAL_ERROR が渡る。
  it('issue #134: API が INTERNAL_ERROR を返したとき onUploadError に SERVER_ERROR_MESSAGES.INTERNAL_ERROR のメッセージが渡る', async () => {
    const onUploadError = vi.fn();
    const onUploadSuccess = vi.fn();

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      }),
    } as unknown as Response);

    renderWithQueryClient(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    await waitFor(() => {
      expect(onUploadError).toHaveBeenCalledWith(
        'サーバーとの通信に失敗しました。しばらくしてから再度お試しください。',
      );
    });
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });
});

// =============================================================================
// ATT-FE-073, 074: 追加モードのローカル保持・バリデーション（issue #115）
// 機能実装前のため FAIL 前提。
// FAIL 原因: AttachmentUploader に mode prop がなく、追加モードでのローカル保持分岐が未実装。
// =============================================================================

describe('AttachmentUploader 追加モード（ATT-FE-073, 074, issue #115）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // setup.ts のグローバル fetch モックを revert（FIX 3）したため、
    // ATT-FE-073/074 で「fetch が呼ばれないこと」を検証するには
    // このブロックで明示的に vi.fn() でスパイ化する（FIX 3 対応）。
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ATT-FE-073: 追加モードでファイル選択すると useUploadAttachment.mutate を呼ばず、
  //             ローカル state に保留し「保存後にアップロード予定」ラベルが表示される。
  // FAIL 原因（機能未実装）: mode prop が未実装のため、追加モードの分岐が存在せず即時アップロードされる。
  // 機能実装後: mode="add" 時にファイル選択しても mutate は呼ばれず、ローカル state に保留される。
  it('ATT-FE-073: buffers_selected_file_in_local_state_in_add_mode', async () => {
    const onUploadSuccess = vi.fn();
    // fetch が呼ばれないことを確認するため、呼ばれた場合にエラーになるようにモックする。
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch should not be called in add mode'));

    renderWithQueryClient(
      <AttachmentUploader
        reportId="rpt-1"
        itemId={null}
        mode="add"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // useUploadAttachment.mutate は呼ばれないこと（fetch 未呼出で確認）。
    // 追加モードではファイルをローカル state に保留する。
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // 「保存後にアップロード予定」ラベルが表示されること（FAIL 前提）。
    expect(screen.getByText('保存後にアップロード予定')).toBeInTheDocument();

    // バリデーションエラーは表示されないこと（JPEG は許可形式）。
    expect(screen.queryByTestId('attachment-validation-error')).not.toBeInTheDocument();
  });

  // ATT-FE-074: クライアント側バリデーション（追加モード）。
  // (a) GIF 拒否 / (b) 5MB+1B 拒否 / (c) 5MB ちょうど許可。いずれも mutate 未呼出。
  // FAIL 原因（機能未実装）: mode prop が未実装のため、追加モードの分岐が存在しない。
  // 機能実装後: 追加モードでもクライアント側バリデーションが動作し、
  //            エラー時はローカル state に保留されず、mutate は呼ばれない。
  it('ATT-FE-074: rejects_invalid_mime_or_oversize_file_in_add_mode_without_buffering', async () => {
    const onUploadSuccess = vi.fn();

    // (a) GIF 拒否。
    {
      const { unmount } = renderWithQueryClient(
        <AttachmentUploader
          reportId="rpt-1"
          itemId={null}
          mode="add"
          onUploadSuccess={onUploadSuccess}
        />,
      );

      const fileInput = screen.getByTestId('attachment-file-input');
      const gifFile = createMockFile('animation.gif', 1024, 'image/gif');
      fireEvent.change(fileInput, { target: { files: [gifFile] } });

      // バリデーションエラーが表示されること（MIME 違反）。
      expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
      // 「保存後にアップロード予定」は表示されないこと（ローカル state に保留されない）。
      expect(screen.queryByText('保存後にアップロード予定')).not.toBeInTheDocument();
      // fetch は呼ばれないこと（mutate 未呼出）。
      expect(globalThis.fetch).not.toHaveBeenCalled();

      unmount();
    }

    // (b) 5MB + 1B 拒否。
    {
      const { unmount } = renderWithQueryClient(
        <AttachmentUploader
          reportId="rpt-1"
          itemId={null}
          mode="add"
          onUploadSuccess={onUploadSuccess}
        />,
      );

      const fileInput = screen.getByTestId('attachment-file-input');
      const oversizeFile = createMockFile('large.jpg', 5242881, 'image/jpeg');
      fireEvent.change(fileInput, { target: { files: [oversizeFile] } });

      // バリデーションエラーが表示されること（サイズ超過）。
      expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
      // ローカル state に保留されないこと。
      expect(screen.queryByText('保存後にアップロード予定')).not.toBeInTheDocument();
      // fetch は呼ばれないこと。
      expect(globalThis.fetch).not.toHaveBeenCalled();

      unmount();
    }

    // (c) ちょうど 5MB は許可。
    {
      renderWithQueryClient(
        <AttachmentUploader
          reportId="rpt-1"
          itemId={null}
          mode="add"
          onUploadSuccess={onUploadSuccess}
        />,
      );

      const fileInput = screen.getByTestId('attachment-file-input');
      const exactlyMaxFile = createMockFile('exactly5mb.jpg', 5242880, 'image/jpeg');
      expect(exactlyMaxFile.size).toBe(5 * 1024 * 1024);
      fireEvent.change(fileInput, { target: { files: [exactlyMaxFile] } });

      // バリデーションエラーは表示されないこと（ちょうど 5MB は許可）。
      expect(screen.queryByTestId('attachment-validation-error')).not.toBeInTheDocument();
      // 「保存後にアップロード予定」が表示されること（ローカル state に保留済み）。
      expect(screen.getByText('保存後にアップロード予定')).toBeInTheDocument();
      // fetch は呼ばれないこと（追加モードでは即時アップロードしない）。
      expect(globalThis.fetch).not.toHaveBeenCalled();
    }
  });

});
