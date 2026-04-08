// AttachmentUploader コンポーネントのユニットテスト。
// report-detail.md §AttachmentUploader の Props 仕様に基づくテスト。
// ATT-FE-050〜056 に対応する。

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import AttachmentUploader from '../AttachmentUploader';

describe('AttachmentUploader', () => {
  // ATT-FE-050: isUploading=false のとき「+ ファイルを追加」ボタンが表示される。
  it('ATT-FE-050: isUploading=false のとき「+ ファイルを追加」テキストが表示される', () => {
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

  // ATT-FE-051: isUploading=true のときアップロード中状態のテキストが表示される。
  it('ATT-FE-051: isUploading=true のとき「アップロード中...」テキストが表示される', () => {
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

  // ATT-FE-052: isUploading=true のときファイル入力が disabled になる。
  it('ATT-FE-052: isUploading=true のときファイル入力が disabled になる', () => {
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
  });

  // ATT-FE-053: isUploading=false のときファイル入力が enabled。
  it('ATT-FE-053: isUploading=false のときファイル入力が enabled', () => {
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
    expect(fileInput).not.toBeDisabled();
  });

  // ATT-FE-054: ファイル入力の accept 属性に許可された MIME タイプが設定されている。
  it('ATT-FE-054: ファイル入力の accept 属性が JPEG・PNG・PDF に設定されている', () => {
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
    const accept = fileInput.getAttribute('accept') ?? '';
    expect(accept).toContain('image/jpeg');
    expect(accept).toContain('image/png');
    expect(accept).toContain('application/pdf');
  });

  // ATT-FE-055: 対応形式とサイズ制限に関する説明テキストが表示される。
  it('ATT-FE-055: 対応形式とサイズ制限の説明が表示される', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    const fileTypes = screen.getByTestId('attachment-file-types');
    // 5MB 制限の説明が含まれること
    expect(fileTypes.textContent).toContain('5');
  });

  // ATT-FE-056: AttachmentUploader がレンダリングされる（基本レンダリングテスト）。
  it('ATT-FE-056: コンポーネントが正常にレンダリングされる', () => {
    const onUploadSuccess = vi.fn();

    render(
      <AttachmentUploader
        reportId="report-001"
        itemId="item-001"
        onUploadSuccess={onUploadSuccess}
        isUploading={false}
      />,
    );

    expect(screen.getByTestId('attachment-uploader')).toBeInTheDocument();
  });
});
