// AttachmentList コンポーネントのユニットテスト。
// report-detail.md §AttachmentList の Props 仕様に基づくテスト。
// ATT-FE-040〜048 に対応する。

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

describe('AttachmentList', () => {
  // ATT-FE-040: attachments が空の場合、空状態メッセージが表示される。
  it('ATT-FE-040: attachments が空の場合、空状態メッセージが表示される', () => {
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

  // ATT-FE-041: attachments にデータがある場合、ファイル名が表示される。
  it('ATT-FE-041: 添付ファイルのファイル名が表示される', () => {
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

    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
  });

  // ATT-FE-042: canDelete=true のとき削除ボタンが表示される。
  it('ATT-FE-042: canDelete=true のとき削除ボタンが表示される', () => {
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

  // ATT-FE-043: canDelete=false のとき削除ボタンが表示されない。
  it('ATT-FE-043: canDelete=false のとき削除ボタンが非表示', () => {
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
  });

  // ATT-FE-044: ファイル名ボタンをクリックすると onDownload コールバックが呼ばれる。
  it('ATT-FE-044: ファイル名クリックで onDownload が呼ばれる', async () => {
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

  // ATT-FE-045: canDelete=true のとき削除ボタンをクリックすると onDelete コールバックが呼ばれる。
  it('ATT-FE-045: 削除ボタンクリックで onDelete が呼ばれる', async () => {
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

  // ATT-FE-046: deletingId が設定されているとき、該当するファイルのボタンが disabled になる。
  it('ATT-FE-046: deletingId と一致する添付のボタンが disabled になる', () => {
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
    // att-001 の削除ボタンが disabled
    expect(screen.getByTestId('attachment-delete-att-001')).toBeDisabled();
    // att-002 のボタンは enabled
    expect(screen.getByTestId('attachment-download-att-002')).not.toBeDisabled();
    expect(screen.getByTestId('attachment-delete-att-002')).not.toBeDisabled();
  });

  // ATT-FE-047: deletingId=null のとき、全ボタンが enabled になる。
  it('ATT-FE-047: deletingId=null のとき全ボタンが enabled', () => {
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

    expect(screen.getByTestId('attachment-download-att-001')).not.toBeDisabled();
    expect(screen.getByTestId('attachment-delete-att-001')).not.toBeDisabled();
  });

  // ATT-FE-048: 各添付のファイルサイズが表示される。
  it('ATT-FE-048: 各添付のファイルサイズが表示される', () => {
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

    expect(screen.getByTestId('attachment-size-att-001')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-002')).toBeInTheDocument();
  });
});
