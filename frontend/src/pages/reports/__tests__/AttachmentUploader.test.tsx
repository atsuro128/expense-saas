// AttachmentUploader コンポーネントのユニットテスト。
// report-detail.md §AttachmentUploader の Props 仕様に基づくテスト。
// ATT-FE-016〜028 に対応する。
//
// 注意: ATT-FE-018〜027 はスタブコンポーネントのため失敗する。
// 機能実装後に通過することを意図している（Step 9 の正しい姿）。

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import AttachmentUploader from '../AttachmentUploader';

// テスト用ファイルオブジェクト生成ヘルパー。
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
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

  // ATT-FE-016: isUploading=false のとき「+ ファイルを追加」ボタンが表示される。
  it('ATT-FE-016: isUploading=false のとき「+ ファイルを追加」テキストが表示される', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('+ ファイルを追加');
  });

  // ATT-FE-017: isUploading=true のときアップロード中状態のテキストが表示される。
  it('ATT-FE-017: isUploading=true のとき「アップロード中...」テキストが表示される', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={true}
      />,
    );

    expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('アップロード中...');
  });

  // ATT-FE-018: JPEG ファイルを選択するとクライアントサイドバリデーションを通過し、mutate が呼ばれる。
  // スタブコンポーネントでは mutate 呼出が未実装のため失敗する。
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

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');

    // ファイル選択イベントを発火する
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // JPEG は許可形式のため mutate が呼ばれ、最終的に fetch（アップロードAPI）が呼ばれること
    // スタブでは fetch が呼ばれないため失敗する（Step 9 の正しい姿）
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  // ATT-FE-019: PNG ファイルを選択するとクライアントサイドバリデーションを通過し、mutate が呼ばれる。
  // スタブコンポーネントでは mutate 呼出が未実装のため失敗する。
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

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const pngFile = createMockFile('receipt.png', 1024, 'image/png');

    fireEvent.change(fileInput, { target: { files: [pngFile] } });

    // PNG は許可形式のため mutate が呼ばれること（スタブでは失敗する）
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  // ATT-FE-020: PDF ファイルを選択するとクライアントサイドバリデーションを通過し、mutate が呼ばれる。
  // スタブコンポーネントでは mutate 呼出が未実装のため失敗する。
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

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const pdfFile = createMockFile('invoice.pdf', 1024, 'application/pdf');

    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    // PDF は許可形式のため mutate が呼ばれること（スタブでは失敗する）
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  // ATT-FE-021: GIF ファイルを選択するとバリデーションエラーメッセージが表示される。
  // スタブコンポーネントではバリデーションエラー表示が未実装のため失敗する。
  it('ATT-FE-021: GIF ファイルを選択するとバリデーションエラーが表示される', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const gifFile = createMockFile('animation.gif', 1024, 'image/gif');

    fireEvent.change(fileInput, { target: { files: [gifFile] } });

    // GIF は許可リスト外のためバリデーションエラーメッセージが表示されること
    // スタブではエラー表示が未実装のため失敗する（Step 9 の正しい姿）
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-022: テキストファイルを選択するとバリデーションエラーメッセージが表示される。
  // スタブコンポーネントではバリデーションエラー表示が未実装のため失敗する。
  it('ATT-FE-022: TXT ファイルを選択するとバリデーションエラーが表示される', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const txtFile = createMockFile('notes.txt', 1024, 'text/plain');

    fireEvent.change(fileInput, { target: { files: [txtFile] } });

    // テキストファイルは許可リスト外のためバリデーションエラーメッセージが表示されること
    // スタブではエラー表示が未実装のため失敗する（Step 9 の正しい姿）
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-023: 5MB + 1B のファイルを選択するとバリデーションエラーが表示される。
  // スタブコンポーネントではバリデーションエラー表示が未実装のため失敗する。
  it('ATT-FE-023: 5MB 超過ファイルを選択するとバリデーションエラーが表示される（境界値）', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // 5MB + 1B のファイル（境界値超過）
    const tooLargeFile = createMockFile('large.jpg', 5242881, 'image/jpeg');
    expect(tooLargeFile.size).toBe(5242881);
    expect(tooLargeFile.size).toBeGreaterThan(5 * 1024 * 1024);

    fireEvent.change(fileInput, { target: { files: [tooLargeFile] } });

    // サイズ超過のためバリデーションエラーメッセージが表示されること
    // スタブではエラー表示が未実装のため失敗する（Step 9 の正しい姿）
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-024: 5MB ちょうどのファイルは許可される（境界値）。
  // スタブコンポーネントでは mutate 呼出が未実装のため、fetch 呼出チェックは失敗する。
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

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // ちょうど 5MB のファイル（境界値・許可）
    const exactlyMaxFile = createMockFile('exactly5mb.jpg', 5242880, 'image/jpeg');
    expect(exactlyMaxFile.size).toBe(5242880);
    expect(exactlyMaxFile.size).toBe(5 * 1024 * 1024);

    fireEvent.change(fileInput, { target: { files: [exactlyMaxFile] } });

    // ちょうど 5MB はバリデーション通過のため mutate が呼ばれ fetch が実行されること
    // スタブでは fetch が呼ばれないため失敗する（Step 9 の正しい姿）
    expect(globalThis.fetch).toHaveBeenCalled();
    // バリデーションエラーが表示されないこと
    expect(screen.queryByTestId('attachment-validation-error')).toBeNull();
  });

  // ATT-FE-025: ドラッグ&ドロップで有効なファイルを受け付け、mutate が呼ばれる。
  // スタブコンポーネントではドロップ処理・mutate 呼出が未実装のため失敗する。
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

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
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
    // スタブではドロップ処理が未実装のため失敗する（Step 9 の正しい姿）
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  // ATT-FE-026: ドラッグ&ドロップで無効なファイル（GIF）を受け付けるとエラーが表示される。
  // スタブコンポーネントではドロップ処理・エラー表示が未実装のため失敗する。
  it('ATT-FE-026: ドロップゾーンへの GIF ドロップでバリデーションエラーが表示される', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
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
    // スタブではドロップ処理が未実装のため失敗する（Step 9 の正しい姿）
    expect(screen.getByTestId('attachment-validation-error')).toBeInTheDocument();
  });

  // ATT-FE-027: アップロード成功後に onUploadSuccess コールバックが呼ばれる。
  // スタブコンポーネントでは onUploadSuccess が呼ばれないため失敗する。
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

    render(
      <AttachmentUploader
        reportId="rpt-1"
        itemId="item-1"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const jpegFile = createMockFile('receipt.jpg', 1024, 'image/jpeg');
    fireEvent.change(fileInput, { target: { files: [jpegFile] } });

    // アップロード成功後に onUploadSuccess が呼ばれること
    // スタブでは onUploadSuccess が呼ばれないため失敗する（Step 9 の正しい姿）
    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // ATT-FE-028: isUploading=true のときファイル入力と「+ ファイルを追加」ボタンが disabled になる。
  it('ATT-FE-028: isUploading=true のときファイル入力が disabled になる', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={true}
      />,
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    expect(fileInput).toBeDisabled();
    expect(screen.getByTestId('attachment-upload-button')).toHaveTextContent('アップロード中...');
  });
});
