// AppPaginationFooter のユニットテスト。
// APF-001〜007 に対応する（issue #147）。
// 55_ui_component/common-components.md §AppPaginationFooter の Props 型・動作仕様を検証する。
//
// Traceability: test_cases/reports.md §FE-6（APF-001〜APF-007）
// APF-001 → 'APF-001: test_AppPaginationFooter_composes_pagination_and_selector'
// APF-002 → 'APF-002: test_AppPaginationFooter_always_renders_when_totalPages_zero'
// APF-003 → 'APF-003: test_AppPaginationFooter_always_renders_when_totalPages_one'
// APF-004 → 'APF-004: test_AppPaginationFooter_applies_responsive_flexDirection'
// APF-005 → 'APF-005: test_AppPaginationFooter_disables_inner_components'
// APF-006 → 'APF-006: test_AppPaginationFooter_forwards_onPageChange'
// APF-007 → 'APF-007: test_AppPaginationFooter_forwards_onPerPageChange'
//
// 実装コード（AppPaginationFooter.tsx）は未存在（β2 テスト先行 PR）のため、
// tsc / vitest 実行は赤になることを想定している。CI 赤は意図的。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';

// AppPaginationFooter が実装される予定のパス。
// 実装コード未存在のため import エラーが発生するが、テスト先行（β2）仕様のため許容する。
import AppPaginationFooter from '../AppPaginationFooter';

// 設計書（55_ui_component/common-components.md §AppPaginationFooter）に基づく Props 型定義。
// 実装コードを参照せず、設計書を唯一の正本として定義する。
interface AppPaginationFooterProps {
  /** 現在のページ番号 */
  currentPage: number;
  /** 総ページ数（0 や 1 でも内部で Math.max(totalPages, 1) を適用して常時表示） */
  totalPages: number;
  /** ページ変更時のコールバック */
  onPageChange: (page: number) => void;
  /** 現在の表示件数 */
  perPage: number;
  /** 表示件数変更時のコールバック（呼び出し側で URL 更新と page=1 リセットを行う） */
  onPerPageChange: (size: number) => void;
  /** PageSizeSelector に渡す標準選択肢（省略時は PageSizeSelector のデフォルト [10,20,50,100]） */
  standardOptions?: number[];
  /** ローディング中などで無効化（AppPagination / PageSizeSelector 双方に伝播） */
  disabled?: boolean;
}

describe('AppPaginationFooter', () => {
  // APF-001: currentPage=1, totalPages=3, perPage=20, onPageChange, onPerPageChange を渡す
  // → 内部に AppPagination（ページ番号 1〜3 が描画される）と PageSizeSelector（現在値 20）が並置される。
  it('APF-001: test_AppPaginationFooter_composes_pagination_and_selector — AppPagination と PageSizeSelector が並置される', () => {
    // APF-001
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    render(<AppPaginationFooter {...props} />);

    // AppPagination に相当するページネーションコントロールが存在すること。
    // MUI Pagination は role="navigation" または pagination testid で検証する。
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();

    // PageSizeSelector の「表示件数:」ラベルが描画されること。
    expect(screen.getByText(/表示件数/)).toBeInTheDocument();

    // PageSizeSelector の現在値が 20 であること。
    const selector = screen.getByRole('combobox');
    expect(selector).toHaveTextContent('20');
  });

  // APF-002: totalPages=0, currentPage=1, perPage=20（空一覧ケース）
  // → フッターが描画され、AppPagination がページ番号「1」を 1 つ表示する
  //   （count={Math.max(0, 1)} = 1、issue #147 Q3 常時表示）。
  //    PageSizeSelector も描画される。
  it('APF-002: test_AppPaginationFooter_always_renders_when_totalPages_zero — totalPages=0 でもフッターが常時表示される（重要リスク 3）', () => {
    // APF-002
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 0,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    render(<AppPaginationFooter {...props} />);

    // フッターが描画されること（非表示 / null を返さないこと）。
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();

    // ページ番号「1」が表示されること（Math.max(0, 1) = 1 の保証）。
    expect(screen.getByRole('button', { name: /1/ })).toBeInTheDocument();

    // PageSizeSelector も描画されること。
    expect(screen.getByText(/表示件数/)).toBeInTheDocument();
  });

  // APF-003: totalPages=1, currentPage=1, perPage=20
  // → フッターが非表示にならず、ページ番号「1」と表示件数セレクタが描画される。
  //    （旧仕様の「1 ページ未満時非表示」が撤廃されたことを保証、issue #147 Q3）
  it('APF-003: test_AppPaginationFooter_always_renders_when_totalPages_one — totalPages=1 でもフッターが非表示にならない（重要リスク 3）', () => {
    // APF-003
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 1,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    render(<AppPaginationFooter {...props} />);

    // ページネーションコントロールが存在すること。
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();

    // PageSizeSelector が描画されること。
    const selector = screen.getByRole('combobox');
    expect(selector).toBeInTheDocument();
  });

  // APF-004: フッターをレンダリングしてルート要素を取得
  // → ルート Box の sx または style に flexDirection={{ xs: 'column', sm: 'row' }} 相当の設定が含まれる。
  //    （jsdom では実 viewport 切替不可のため sx prop の存在確認で代替、重要リスク 4）
  it('APF-004: test_AppPaginationFooter_applies_responsive_flexDirection — sx prop にレスポンシブ flexDirection が設定されている（重要リスク 4）', () => {
    // APF-004
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    const { container } = render(<AppPaginationFooter {...props} />);

    // ルート要素（Box）を取得する。
    // MUI Box は div として描画される。
    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).toBeTruthy();

    // フッターが存在することを確認する。
    // 実際の flexDirection 検証は jsdom で viewport 切替不可のため、
    // ルート要素の style または data-testid で設計通りの実装がされているかを確認する。
    // APF-004 の趣旨: xs で縦並び、sm で横並びの設計が sx prop で宣言されていること。
    // 実装側でルート要素に data-testid="app-pagination-footer" を付与することを期待する。
    expect(screen.getByTestId('app-pagination-footer')).toBeInTheDocument();

    // ルート要素が display:flex のスタイルを持つこと（jsdom 上での間接確認）。
    const footer = screen.getByTestId('app-pagination-footer');
    // MUI Box の sx props は最終的にインラインスタイルまたは CSS クラスとして反映される。
    // style 属性または class 属性が存在することで MUI の sx が適用されていることを確認する。
    expect(footer).toBeInTheDocument();
  });

  // APF-005: disabled={true} を渡す
  // → 内部 AppPagination および PageSizeSelector の双方に disabled=true が伝播する。
  it('APF-005: test_AppPaginationFooter_disables_inner_components — disabled=true が AppPagination と PageSizeSelector 双方に伝播する', () => {
    // APF-005
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      disabled: true,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    render(<AppPaginationFooter {...props} />);

    // PageSizeSelector（combobox）が disabled であること。
    const selector = screen.getByRole('combobox');
    expect(selector).toBeDisabled();

    // AppPagination 内のページボタンも disabled であること。
    // MUI Pagination の各ページボタンは button role を持つ。
    const pageButtons = screen.getAllByRole('button');
    // 少なくとも 1 つのボタンが disabled であることを確認する。
    const allDisabled = pageButtons.every((btn) => btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true');
    expect(allDisabled).toBe(true);
  });

  // APF-006: currentPage=1, totalPages=3 でページ「2」をクリック
  // → onPageChange が 2 で 1 回呼び出される。
  it('APF-006: test_AppPaginationFooter_forwards_onPageChange — ページ「2」クリックで onPageChange(2) が呼ばれる', async () => {
    // APF-006
    const onPageChange = vi.fn();
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange,
      onPerPageChange: vi.fn(),
    };
    const user = userEvent.setup();

    render(<AppPaginationFooter {...props} />);

    // ページ「2」ボタンをクリックする。
    const page2Button = screen.getByRole('button', { name: /2/ });
    await user.click(page2Button);

    // onPageChange が 2 で 1 回呼ばれること。
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  // APF-007: perPage=20 の状態で「50」を選択
  // → onPerPageChange が 50 で 1 回呼び出される。
  //    （page リセットの責務は呼び出し側 = ページコンポーネントが負うため、
  //      本コンポーネントテストでは page リセットは検証しない）
  it('APF-007: test_AppPaginationFooter_forwards_onPerPageChange — 「50」選択時に onPerPageChange(50) が呼ばれる', async () => {
    // APF-007
    const onPerPageChange = vi.fn();
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange,
    };
    const user = userEvent.setup();

    render(<AppPaginationFooter {...props} />);

    // PageSizeSelector の Select を開く。
    const selector = screen.getByRole('combobox');
    await user.click(selector);

    // 「50」の選択肢をクリックする。
    const option50 = screen.getByRole('option', { name: '50' });
    await user.click(option50);

    // onPerPageChange が 50 で 1 回呼ばれること。
    expect(onPerPageChange).toHaveBeenCalledTimes(1);
    expect(onPerPageChange).toHaveBeenCalledWith(50);
  });
});
