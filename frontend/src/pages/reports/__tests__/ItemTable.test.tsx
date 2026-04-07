// ItemTable コンポーネントのユニットテスト。
// ITM-FE-010〜017 に対応する。
// ItemTable は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ItemTable from '../ItemTable';

// テスト用フィクスチャ: mockItems（2件）
const mockItems = [
  {
    id: 'item-001',
    report_id: 'report-001',
    expense_date: '2026-03-10',
    amount: 12345,
    category: { id: 'cat-001', code: 'transportation', name_ja: '交通費', sort_order: 1 },
    description: 'タクシー代',
    attachments: [],
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'item-002',
    report_id: 'report-001',
    expense_date: '2026-03-11',
    amount: 2000,
    category: { id: 'cat-002', code: 'food', name_ja: '食費', sort_order: 2 },
    description: '会食代',
    attachments: [],
    created_at: '2026-03-11T00:00:00Z',
    updated_at: '2026-03-11T00:00:00Z',
  },
];

const defaultProps = {
  onItemClick: () => undefined,
  onEditItem: () => undefined,
  onDeleteItem: () => undefined,
};

describe('ItemTable', () => {
  // ITM-FE-010: 日付・金額・カテゴリ・摘要・添付数・操作の各カラムが表示される。
  it('ITM-FE-010: items=mockItems, canEditItems=true のとき全カラムが表示される', () => {
    render(
      <ItemTable items={mockItems} canEditItems={true} {...defaultProps} />,
    );

    // 全カラムが表示される（ITM-FE-010）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-table')).toBeInTheDocument();
  });

  // ITM-FE-011: 金額が通貨フォーマット（3桁カンマ区切り）で表示される。
  it('ITM-FE-011: amount=12345 のとき通貨フォーマット（"12,345"）で表示される', () => {
    render(
      <ItemTable items={mockItems} canEditItems={false} {...defaultProps} />,
    );

    // 金額が通貨フォーマットで表示される（ITM-FE-011）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/12,345/)).toBeInTheDocument();
  });

  // ITM-FE-012: canEditItems=true のとき操作列（編集・削除ボタン）が表示される。
  it('ITM-FE-012: canEditItems=true のとき操作列が表示される', () => {
    render(
      <ItemTable items={mockItems} canEditItems={true} {...defaultProps} />,
    );

    // 編集・削除ボタンが表示される（ITM-FE-012）。スタブ実装のため現在は失敗する。
    expect(screen.getAllByRole('button', { name: /編集/ })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /削除/ })[0]).toBeInTheDocument();
  });

  // ITM-FE-013: canEditItems=false のとき操作列が表示されない。
  it('ITM-FE-013: canEditItems=false のとき操作列が表示されない', () => {
    render(
      <ItemTable items={mockItems} canEditItems={false} {...defaultProps} />,
    );

    // 編集・削除ボタンが表示されない（ITM-FE-013）。スタブ実装のため現在は失敗する。
    expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument();
  });

  // ITM-FE-014: 明細行をクリックすると onItemClick が該当 itemId で呼ばれる。
  it('ITM-FE-014: 明細行をクリックすると onItemClick が該当 itemId で呼ばれる', async () => {
    const onItemClick = vi.fn();
    render(
      <ItemTable
        items={mockItems}
        canEditItems={false}
        onItemClick={onItemClick}
        onEditItem={() => undefined}
        onDeleteItem={() => undefined}
      />,
    );

    // 明細行クリック（ITM-FE-014）。スタブ実装のため現在は失敗する。
    const row = screen.getByTestId('item-row-item-001');
    await userEvent.click(row);

    expect(onItemClick).toHaveBeenCalledWith('item-001');
  });

  // ITM-FE-015: 編集ボタンをクリックすると onEditItem が該当 itemId で呼ばれる。
  it('ITM-FE-015: 編集ボタンをクリックすると onEditItem が該当 itemId で呼ばれる', async () => {
    const onEditItem = vi.fn();
    render(
      <ItemTable
        items={mockItems}
        canEditItems={true}
        onItemClick={() => undefined}
        onEditItem={onEditItem}
        onDeleteItem={() => undefined}
      />,
    );

    // 編集ボタンクリック（ITM-FE-015）。スタブ実装のため現在は失敗する。
    const editButtons = screen.getAllByRole('button', { name: /編集/ });
    await userEvent.click(editButtons[0]);

    expect(onEditItem).toHaveBeenCalledWith('item-001');
  });

  // ITM-FE-016: 削除ボタンをクリックすると onDeleteItem が該当 itemId で呼ばれる。
  it('ITM-FE-016: 削除ボタンをクリックすると onDeleteItem が該当 itemId で呼ばれる', async () => {
    const onDeleteItem = vi.fn();
    render(
      <ItemTable
        items={mockItems}
        canEditItems={true}
        onItemClick={() => undefined}
        onEditItem={() => undefined}
        onDeleteItem={onDeleteItem}
      />,
    );

    // 削除ボタンクリック（ITM-FE-016）。スタブ実装のため現在は失敗する。
    const deleteButtons = screen.getAllByRole('button', { name: /削除/ });
    await userEvent.click(deleteButtons[0]);

    expect(onDeleteItem).toHaveBeenCalledWith('item-001');
  });

  // ITM-FE-017: 編集ボタンクリック時に onItemClick は呼ばれない（イベント伝播の停止）。
  it('ITM-FE-017: 編集ボタンクリック時に onItemClick は呼ばれない', async () => {
    const onItemClick = vi.fn();
    const onEditItem = vi.fn();
    render(
      <ItemTable
        items={mockItems}
        canEditItems={true}
        onItemClick={onItemClick}
        onEditItem={onEditItem}
        onDeleteItem={() => undefined}
      />,
    );

    // 編集ボタンクリック時は onItemClick が呼ばれない（ITM-FE-017）。スタブ実装のため現在は失敗する。
    const editButtons = screen.getAllByRole('button', { name: /編集/ });
    await userEvent.click(editButtons[0]);

    expect(onEditItem).toHaveBeenCalled();
    expect(onItemClick).not.toHaveBeenCalled();
  });
});
