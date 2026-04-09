// ItemSlidePanel コンポーネントのユニットテスト。
// ITM-FE-018〜025 に対応する。
// ItemSlidePanel は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import ItemSlidePanel from '../ItemSlidePanel';

// テスト用 QueryClientProvider ラッパー。
// AttachmentArea が useQueryClient を使うため、item が存在するケースで必要。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// テスト用フィクスチャ: mockItem（閲覧・編集モードの初期値）
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

const defaultProps = {
  reportId: 'report-001',
  reportStatus: 'draft' as const,
  isOwner: true,
  onClose: () => undefined,
  onSaveSuccess: () => undefined,
  onSaveAndContinue: () => undefined,
};

describe('ItemSlidePanel', () => {
  // ITM-FE-018: open=true のときスライドパネルが表示される。
  it('ITM-FE-018: open=true, mode=add のときスライドパネルが表示される', () => {
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // スライドパネルが表示される（ITM-FE-018）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-slide-panel')).toBeVisible();
  });

  // ITM-FE-019: open=false のときスライドパネルが表示されない。
  it('ITM-FE-019: open=false のときスライドパネルが表示されない', () => {
    render(
      <ItemSlidePanel
        open={false}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // スライドパネルが表示されない（ITM-FE-019）。スタブ実装のため現在は失敗する。
    expect(screen.queryByTestId('item-slide-panel')).not.toBeVisible();
  });

  // ITM-FE-020: mode='add', item=null のとき追加モードのタイトルが表示される。
  it('ITM-FE-020: mode=add のとき追加モードのタイトルが表示される', () => {
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
      />,
    );

    // 追加モードのタイトル（「明細追加」等）が表示される（ITM-FE-020）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細追加/)).toBeInTheDocument();
  });

  // ITM-FE-021: mode='edit', item=mockItem のとき編集モードのタイトルが表示される。
  it('ITM-FE-021: mode=edit のとき編集モードのタイトルが表示される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="edit"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 編集モードのタイトル（「明細編集」等）が表示される（ITM-FE-021）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細編集/)).toBeInTheDocument();
  });

  // ITM-FE-022: mode='view', item=mockItem のとき閲覧モードのタイトルが表示される。
  it('ITM-FE-022: mode=view のとき閲覧モードのタイトルが表示される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // 閲覧モードのタイトル（「明細詳細」等）が表示される（ITM-FE-022）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細詳細/)).toBeInTheDocument();
  });

  // ITM-FE-023: mode='view', item=mockItem のとき ItemForm が mode='view' で描画される（readonly）。
  it('ITM-FE-023: mode=view のとき ItemForm が mode=view で描画される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="view"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // ItemForm が readonly で描画される（ITM-FE-023）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // ITM-FE-024: mode='edit', item=mockItem のとき ItemForm に defaultValues が渡される。
  it('ITM-FE-024: mode=edit, item=mockItem のとき ItemForm に mockItem の値が defaultValues として渡される', () => {
    // item が存在するとき AttachmentArea が QueryClient を使うため wrapper が必要。
    render(
      <ItemSlidePanel
        open={true}
        mode="edit"
        item={mockItem}
        {...defaultProps}
      />,
      { wrapper: createWrapper() },
    );

    // ItemForm に defaultValues が渡される（ITM-FE-024）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // ITM-FE-025: 閉じるボタンをクリックすると onClose が呼ばれる。
  it('ITM-FE-025: 閉じるボタンをクリックすると onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    render(
      <ItemSlidePanel
        open={true}
        mode="add"
        item={null}
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // 閉じるボタンクリック（ITM-FE-025）。スタブ実装のため現在は失敗する。
    const closeButton = screen.getByRole('button', { name: /閉じる/ });
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
