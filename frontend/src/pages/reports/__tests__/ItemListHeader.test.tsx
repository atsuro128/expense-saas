// ItemListHeader コンポーネントのユニットテスト。
// ITM-FE-005〜009 に対応する。
// ItemListHeader は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ItemListHeader from '../ItemListHeader';

describe('ItemListHeader', () => {
  // ITM-FE-005: itemCount=3 のとき件数が表示される。
  it('ITM-FE-005: itemCount=3 のとき「明細一覧（3件）」の見出しテキストが表示される', () => {
    render(
      <ItemListHeader itemCount={3} canAddItem={true} onAddItem={() => undefined} />,
    );

    // 「明細一覧（3件）」のような見出しが表示される（ITM-FE-005）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/3件/)).toBeInTheDocument();
  });

  // ITM-FE-006: itemCount=0 のとき「0件」が表示される。
  it('ITM-FE-006: itemCount=0 のとき「明細一覧（0件）」の見出しテキストが表示される', () => {
    render(
      <ItemListHeader itemCount={0} canAddItem={true} onAddItem={() => undefined} />,
    );

    // 「明細一覧（0件）」のような見出しが表示される（ITM-FE-006）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/0件/)).toBeInTheDocument();
  });

  // ITM-FE-007: canAddItem=true のとき「明細追加」ボタンが表示される。
  it('ITM-FE-007: canAddItem=true のとき「明細追加」ボタンが表示される', () => {
    render(
      <ItemListHeader itemCount={2} canAddItem={true} onAddItem={() => undefined} />,
    );

    // 「明細追加」ボタンが表示される（ITM-FE-007）。スタブ実装のため現在は失敗する。
    expect(screen.getByRole('button', { name: /明細追加/ })).toBeInTheDocument();
  });

  // ITM-FE-008: canAddItem=false のとき「明細追加」ボタンが表示されない。
  it('ITM-FE-008: canAddItem=false のとき「明細追加」ボタンが表示されない', () => {
    render(
      <ItemListHeader itemCount={2} canAddItem={false} onAddItem={() => undefined} />,
    );

    // 「明細追加」ボタンが表示されない（ITM-FE-008）。スタブ実装のため現在は失敗する。
    expect(screen.queryByRole('button', { name: /明細追加/ })).not.toBeInTheDocument();
  });

  // ITM-FE-009: 「明細追加」ボタンをクリックすると onAddItem が呼ばれる。
  it('ITM-FE-009: 「明細追加」ボタンをクリックすると onAddItem が呼ばれる', async () => {
    const onAddItem = vi.fn();
    render(
      <ItemListHeader itemCount={0} canAddItem={true} onAddItem={onAddItem} />,
    );

    // 「明細追加」ボタンが表示されるはず（ITM-FE-009）。スタブ実装のため現在は失敗する。
    const button = screen.getByRole('button', { name: /明細追加/ });
    await userEvent.click(button);

    expect(onAddItem).toHaveBeenCalledTimes(1);
  });
});
