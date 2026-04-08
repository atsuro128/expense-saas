// ItemListSection コンポーネントのユニットテスト。
// ITM-FE-001〜004 に対応する。
// ItemListSection は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import ItemListSection from '../ItemListSection';

// テスト用フィクスチャ: mockItems（2件）
const mockItems = [
  {
    id: 'item-001',
    report_id: 'report-001',
    expense_date: '2026-03-10',
    amount: 1000,
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
  onAddItem: () => undefined,
  onItemClick: () => undefined,
  onEditItem: () => undefined,
  onDeleteItem: () => undefined,
};

describe('ItemListSection', () => {
  // ITM-FE-001: items=mockItems（2件）の場合、セクションが描画される。
  it('ITM-FE-001: items=mockItems, isOwner=true, status=draft のときセクションが描画される', () => {
    render(
      <ItemListSection
        items={mockItems}
        isOwner={true}
        status="draft"
        {...defaultProps}
      />,
    );

    // ItemListSection が描画される（ITM-FE-001）。スタブのため現在は "NOT IMPLEMENTED" のみ表示。
    expect(screen.getByTestId('item-list-section')).toBeInTheDocument();
  });

  // ITM-FE-002: items=[], isOwner=true, status='draft' のとき EmptyState が表示される（操作ガイド付き）。
  it('ITM-FE-002: items=[], isOwner=true, status=draft のとき EmptyState が表示される', () => {
    render(
      <ItemListSection
        items={[]}
        isOwner={true}
        status="draft"
        {...defaultProps}
      />,
    );

    // EmptyState が「明細はまだ追加されていません」メッセージで表示される（ITM-FE-002）。
    // スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細はまだ追加されていません/)).toBeInTheDocument();
  });

  // ITM-FE-003: items=[], isOwner=false, status='draft' のとき EmptyState が表示される（ガイド文言なし）。
  it('ITM-FE-003: items=[], isOwner=false, status=draft のとき EmptyState が表示される（所有者向け案内なし）', () => {
    render(
      <ItemListSection
        items={[]}
        isOwner={false}
        status="draft"
        {...defaultProps}
      />,
    );

    // EmptyState が「明細はまだ追加されていません」メッセージで表示される（ITM-FE-003）。
    // スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細はまだ追加されていません/)).toBeInTheDocument();
  });

  // ITM-FE-004: items=[], isOwner=true, status='submitted' のとき EmptyState が表示される（操作ガイドなし）。
  it('ITM-FE-004: items=[], isOwner=true, status=submitted のとき EmptyState が表示される（draft 以外では操作ガイドなし）', () => {
    render(
      <ItemListSection
        items={[]}
        isOwner={true}
        status="submitted"
        {...defaultProps}
      />,
    );

    // EmptyState が「明細はまだ追加されていません」メッセージで表示される（ITM-FE-004）。
    // スタブ実装のため現在は失敗する。
    expect(screen.getByText(/明細はまだ追加されていません/)).toBeInTheDocument();
  });
});
