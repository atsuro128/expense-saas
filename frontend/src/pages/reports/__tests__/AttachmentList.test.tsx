// AttachmentList コンポーネントのユニットテスト。
// report-detail.md §AttachmentList の Props 仕様に基づくテスト。
// ATT-FE-007〜015 に対応する。
// 新構造: AttachmentList が per-item hook orchestration を内包するため、
//   useAttachmentDownloadUrl・useAttachmentPreviewUrl を vi.mock する。
// window.open の呼び出しは AttachmentItemRow 内部で担当するため、
//   callback 経由の検証ではなく data-testid ベースで振る舞いを確認する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Attachment } from '../../../api/types';
import AttachmentList from '../AttachmentList';

// per-item hook を mock して fetch 呼び出しを排除する。
// refetch を返す最小限のスタブで、クリックテストで window.open が呼ばれることを確認できる。
const mockRefetchDownload = vi.fn().mockResolvedValue({ data: { data: { url: '' } } });
const mockRefetchPreview = vi.fn().mockResolvedValue({ data: { data: { url: '' } } });

vi.mock('../../../hooks/useAttachmentDownloadUrl', () => ({
  useAttachmentDownloadUrl: () => ({ refetch: mockRefetchDownload }),
}));

vi.mock('../../../hooks/useAttachmentPreviewUrl', () => ({
  useAttachmentPreviewUrl: () => ({ refetch: mockRefetchPreview }),
}));

// QueryClientProvider でラップするためのヘルパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

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

// テスト共通のデフォルト Props。
const defaultProps = {
  reportId: 'rpt-001',
  itemId: 'item-001',
};

describe('AttachmentList', () => {
  // ATT-FE-007: ファイル情報（ファイル名・ファイルサイズ）が表示される。
  // ファイルサイズは formatFileSize でフォーマットされた文字列（例: "240 KB"）で表示される。
  it('ATT-FE-007: ファイル名とファイルサイズがフォーマット済みで表示される', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={[sampleAttachments[0]!]}
        canDelete={true}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    // file_size=245760 バイト → "240 KB" と表示されること。
    const sizeEl = screen.getByTestId('attachment-size-att-001');
    expect(sizeEl).toBeInTheDocument();
    expect(sizeEl).toHaveTextContent('240 KB');
  });

  // ATT-FE-007b: ファイルサイズが 1MB 以上の場合は "X.X MB" 形式で表示される。
  it('ATT-FE-007b: file_size が 1MB 以上のとき "X.X MB" 形式で表示される', () => {
    const Wrapper = createWrapper();
    const largeFile: Attachment = {
      id: 'att-large',
      item_id: 'item-001',
      file_name: 'large.pdf',
      file_size: 2859424,
      mime_type: 'application/pdf',
      created_at: '2026-03-01T00:00:00Z',
    };

    render(
      <AttachmentList
        {...defaultProps}
        attachments={[largeFile]}
        canDelete={false}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    // file_size=2859424 バイト → "2.7 MB" と表示されること。
    const sizeEl = screen.getByTestId('attachment-size-att-large');
    expect(sizeEl).toHaveTextContent('2.7 MB');
  });

  // ATT-FE-008: attachments が空の場合、添付ファイルの行要素が描画されない。
  it('ATT-FE-008: attachments が空の場合、空状態メッセージが表示される', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={[]}
        canDelete={false}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('attachment-list-empty')).toBeInTheDocument();
  });

  // ATT-FE-009: 複数件の添付ファイルがそれぞれファイル名・ファイルサイズとともに表示される。
  it('ATT-FE-009: 3件の添付ファイルがそれぞれ表示される', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={threeAttachments}
        canDelete={true}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-001')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-002')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-size-att-003')).toBeInTheDocument();
  });

  // ATT-FE-010: ファイル名クリックで window.open が呼ばれる（per-item hook 内包）。
  // AttachmentItemRow が内部で useAttachmentPreviewUrl を保持し、クリック時に
  // window.open('about:blank', '_blank') を同期で開く。
  it('ATT-FE-010: ファイル名クリックで window.open が呼ばれる', async () => {
    const Wrapper = createWrapper();
    const mockWindowObj = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(mockWindowObj as unknown as Window);

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={false}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await userEvent.click(screen.getByTestId('attachment-preview-att-001'));

    // クリック同期で window.open('about:blank', '_blank') が呼ばれること。
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
  });

  // ATT-FE-010b: ↓ アイコンクリックで window.open が呼ばれる（per-item hook 内包）。
  it('ATT-FE-010b: ↓ アイコンクリックで window.open が呼ばれる', async () => {
    const Wrapper = createWrapper();
    const mockWindowObj = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(mockWindowObj as unknown as Window);

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={false}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await userEvent.click(screen.getByTestId('attachment-download-att-001'));

    // クリック同期で window.open('about:blank', '_blank') が呼ばれること。
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
  });

  // ATT-FE-011: canDelete=true のとき削除ボタンが表示される。
  it('ATT-FE-011: canDelete=true のとき削除ボタンが表示される', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={true}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    expect(deleteButtons).toHaveLength(2);
  });

  // ATT-FE-012: canDelete=false のとき削除ボタンが非表示。
  it('ATT-FE-012: canDelete=false のとき削除ボタンが非表示', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={false}
        deletingId={null}
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    // ファイル名のプレビューボタンは表示される。
    expect(screen.getByTestId('attachment-preview-att-001')).toBeInTheDocument();
    // ↓ アイコンボタンも表示される。
    expect(screen.getByTestId('attachment-download-att-001')).toBeInTheDocument();
  });

  // ATT-FE-013: 削除ボタンクリックで onDelete が呼ばれる。
  it('ATT-FE-013: 削除ボタンクリックで onDelete が呼ばれる', async () => {
    const Wrapper = createWrapper();
    const onDelete = vi.fn();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={true}
        deletingId={null}
        onDelete={onDelete}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await userEvent.click(screen.getByTestId('attachment-delete-att-001'));

    expect(onDelete).toHaveBeenCalledWith('att-001');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // ATT-FE-014: deletingId が設定されているとき、該当するファイルの行がグレーアウトされる。
  it('ATT-FE-014: deletingId と一致する添付のボタンが disabled になる', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={true}
        deletingId="att-001"
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    // att-001 のプレビューボタンが disabled。
    expect(screen.getByTestId('attachment-preview-att-001')).toBeDisabled();
    // att-001 の ↓ アイコンが disabled。
    expect(screen.getByTestId('attachment-download-att-001')).toBeDisabled();
    // att-002 のボタンは enabled。
    expect(screen.getByTestId('attachment-preview-att-002')).not.toBeDisabled();
    expect(screen.getByTestId('attachment-download-att-002')).not.toBeDisabled();
  });

  // ATT-FE-015: deletingId と一致する添付の削除ボタンが disabled になる。
  it('ATT-FE-015: deletingId="att-001" のとき att-001 の削除ボタンが disabled になる', () => {
    const Wrapper = createWrapper();

    render(
      <AttachmentList
        {...defaultProps}
        attachments={sampleAttachments}
        canDelete={true}
        deletingId="att-001"
        onDelete={vi.fn()}
        onError={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    // att-001 の削除ボタンが disabled。
    expect(screen.getByTestId('attachment-delete-att-001')).toBeDisabled();
    // att-002 の削除ボタンは enabled。
    expect(screen.getByTestId('attachment-delete-att-002')).not.toBeDisabled();
  });
});
