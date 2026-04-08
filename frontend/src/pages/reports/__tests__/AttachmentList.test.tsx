// AttachmentList コンポーネントのユニットテスト。
// report-detail.md §AttachmentList の Props 仕様に基づくテスト。
// ATT-FE-007〜015 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Attachment } from '../../../api/types';
import AttachmentList from '../AttachmentList';

// テスト用添付ファイルデータ。
const sampleAttachments: Attachment[] = [
  {
    id: 'att-001',
    item_id: 'item-001',
    file_name: 'receipt.jpg',
    file_size: 245760,
    mime_type: 'image/jpeg',
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'att-002',
    item_id: 'item-001',
    file_name: 'invoice.pdf',
    file_size: 102400,
    mime_type: 'application/pdf',
    created_at: '2026-03-02T00:00:00Z',
  },
];

// 3件のテスト用添付ファイルデータ。
const threeAttachments: Attachment[] = [
  ...sampleAttachments,
  {
    id: 'att-003',
    item_id: 'item-001',
    file_name: 'contract.pdf',
    file_size: 51200,
    mime_type: 'application/pdf',
    created_at: '2026-03-03T00:00:00Z',
  },
];

describe('AttachmentList', () => {
  // ATT-FE-007: ファイル情報（ファイル名・ファイルサイズ）が表示される。
  it('ATT-FE-007: ファイル名とファイルサイズが表示される', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={[sampleAttachments[0]!]}
        canDelete={true}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-001')).toBeInTheDocument();
  });

  // ATT-FE-008: attachments が空の場合、添付ファイルの行要素が描画されない。
  it('ATT-FE-008: attachments が空の場合、空状態メッセージが表示される', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={[]}
        canDelete={false}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    expect(screen.getByTestId('attachment-list-empty')).toBeInTheDocument();
  });

  // ATT-FE-009: 複数件の添付ファイルがそれぞれファイル名・ファイルサイズとともに表示される。
  it('ATT-FE-009: 3件の添付ファイルがそれぞれ表示される', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={threeAttachments}
        canDelete={true}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-001')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-002')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-003')).toBeInTheDocument();
  });

  // ATT-FE-010: ファイル名クリックで onDownload が呼ばれる。
  it('ATT-FE-010: ファイル名クリックで onDownload が呼ばれる', async () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={sampleAttachments}
        canDelete={false}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    await userEvent.click(screen.getByTestId('attachment-download-att-001'));

    expect(onDownload).toHaveBeenCalledWith('att-001');
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  // ATT-FE-011: canDelete=true のとき削除ボタンが表示される。
  it('ATT-FE-011: canDelete=true のとき削除ボタンが表示される', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={sampleAttachments}
        canDelete={true}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    expect(deleteButtons).toHaveLength(2);
  });

  // ATT-FE-012: canDelete=false のとき削除ボタンが非表示。
  it('ATT-FE-012: canDelete=false のとき削除ボタンが非表示', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={sampleAttachments}
        canDelete={false}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    // ファイル名のダウンロードボタンは表示される
    expect(screen.getByTestId('attachment-download-att-001')).toBeInTheDocument();
  });

  // ATT-FE-013: 削除ボタンクリックで onDelete が呼ばれる。
  it('ATT-FE-013: 削除ボタンクリックで onDelete が呼ばれる', async () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={sampleAttachments}
        canDelete={true}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));

    expect(onDelete).toHaveBeenCalledWith('att-001');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // ATT-FE-014: deletingId が設定されているとき、該当するファイルの行がグレーアウトされる。
  it('ATT-FE-014: deletingId と一致する添付のボタンが disabled になる', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={sampleAttachments}
        canDelete={true}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId="att-001"
      />,
    );

    // att-001 のダウンロードボタンが disabled
    expect(screen.getByTestId('attachment-download-att-001')).toBeDisabled();
    // att-002 のボタンは enabled
    expect(screen.getByTestId('attachment-download-att-002')).not.toBeDisabled();
  });

  // ATT-FE-015: deletingId と一致する添付の削除ボタンが disabled になる。
  it('ATT-FE-015: deletingId="att-001" のとき att-001 の削除ボタンが disabled になる', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        attachments={sampleAttachments}
        canDelete={true}
        onDownload={onDownload}
        onDelete={onDelete}
        deletingId="att-001"
      />,
    );

    // att-001 の削除ボタンが disabled
    expect(screen.getByTestId('attachment-delete-att-001')).toBeDisabled();
    // att-002 の削除ボタンは enabled
    expect(screen.getByTestId('attachment-delete-att-002')).not.toBeDisabled();
  });
});
