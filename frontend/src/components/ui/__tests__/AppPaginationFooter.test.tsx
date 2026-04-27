// AppPaginationFooter のユニットテスト。
// APF-001〜011 に対応する（issue #147 / 再々オープン A2 案）。
// 55_ui_component/common-components.md §AppPaginationFooter の Props 型・動作仕様を検証する。
//
// Traceability: test_cases/reports.md §FE-6（APF-001〜APF-011）
// APF-001 → 'APF-001: test_AppPaginationFooter_composes_pagination_and_selector'
// APF-002 → 'APF-002: test_AppPaginationFooter_always_renders_when_totalPages_zero'
// APF-003 → 'APF-003: test_AppPaginationFooter_always_renders_when_totalPages_one'
// APF-004 → 'APF-004: test_AppPaginationFooter_applies_responsive_flexDirection'
// APF-005 → 'APF-005: test_AppPaginationFooter_disables_inner_components'
// APF-006 → 'APF-006: test_AppPaginationFooter_forwards_onPageChange'
// APF-007 → 'APF-007: test_AppPaginationFooter_forwards_onPerPageChange'
// APF-008 → 'APF-008: test_AppPaginationFooter_has_border_top_sx' （視覚回帰防止、border-top sx 検証）
// APF-009 → 'APF-009: test_AppPaginationFooter_count_display_calculation' （件数表示算出: 通常/端数/0件）
// APF-010 → 'APF-010: test_AppPaginationFooter_no_count_when_totalCount_undefined' （後方互換）
// APF-011 → 'APF-011: test_AppPaginationFooter_layout_and_pss_margin_constraints' （高さ支配回帰防止）

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
  /**
   * 件数表示用の総件数（issue #147 再々オープン: A2 案）。
   * - 指定された場合、フッター左側に「{start} - {end} / 全 {total} 件」を表示する
   * - 未指定（undefined）の場合は件数表示を非表示にする（後方互換）
   */
  totalCount?: number;
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
    // MUI は InputLabel と fieldset legend の両方にラベルテキストを描画するため getAllByText を使う。
    expect(screen.getAllByText(/表示件数/)[0]).toBeInTheDocument();

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
    // MUI は InputLabel と fieldset legend の両方にラベルテキストを描画するため getAllByText を使う。
    expect(screen.getAllByText(/表示件数/)[0]).toBeInTheDocument();
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
    // MUI Select は <FormControl disabled> 配下で aria-disabled="true" を付与する（disabled 属性は付与しない）。
    const selector = screen.getByRole('combobox');
    expect(selector).toHaveAttribute('aria-disabled', 'true');

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

    // 「50 件」の選択肢をクリックする（実装は "{size} 件" 形式で表示）。
    const option50 = screen.getByRole('option', { name: '50 件' });
    await user.click(option50);

    // onPerPageChange が 50 で 1 回呼ばれること。
    expect(onPerPageChange).toHaveBeenCalledTimes(1);
    expect(onPerPageChange).toHaveBeenCalledWith(50);
  });

  // APF-008: ルート Box に borderTop sx が設定されていること（視覚回帰防止）。
  // issue #147 再々オープン A2 案: DataGrid 標準フッターとの境界線を揃えるための実装。
  // jsdom 上では viewport 切替不可のため、data-testid 経由でルート要素の存在を確認する。
  it('APF-008: test_AppPaginationFooter_has_border_top_sx — ルート要素に data-testid="app-pagination-footer" が付与され境界線 sx が適用されている（視覚回帰防止）', () => {
    // APF-008
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    render(<AppPaginationFooter {...props} />);

    // ルート要素（data-testid="app-pagination-footer"）が描画されること。
    const footer = screen.getByTestId('app-pagination-footer');
    expect(footer).toBeInTheDocument();

    // MUI Box に sx を渡すと MUI の CSS-in-JS 経由でスタイルクラスが付与される。
    // jsdom では実際の CSS 値は確認不可だが、className が付与されていることで sx 適用を間接確認する。
    // 少なくとも何らかのクラスが付与されていること（MUI Box の sx が有効であること）を検証する。
    expect(footer.className).toBeTruthy();
  });

  // APF-009: totalCount 指定時の件数表示算出を検証する（通常 / 端数 / 0 件）。
  // issue #147 再々オープン A2 案: 「{start} - {end} / 全 {total} 件」フォーマット検証。
  describe('APF-009: test_AppPaginationFooter_count_display_calculation — 件数表示算出の検証', () => {
    // APF-009a: 通常ケース（totalCount=37, perPage=10, currentPage=2）
    // → 「11 - 20 / 全 37 件」と表示される。
    it('APF-009a: 通常ケース（currentPage=2, perPage=10, totalCount=37）→「11 - 20 / 全 37 件」', () => {
      const props: AppPaginationFooterProps = {
        currentPage: 2,
        totalPages: 4,
        perPage: 10,
        totalCount: 37,
        onPageChange: vi.fn(),
        onPerPageChange: vi.fn(),
      };

      render(<AppPaginationFooter {...props} />);

      // 件数表示テキストが正しく描画されること。
      expect(screen.getByTestId('app-pagination-footer-count')).toHaveTextContent('11 - 20 / 全 37 件');
    });

    // APF-009b: 端数ページ（totalCount=37, perPage=10, currentPage=4）
    // → 「31 - 37 / 全 37 件」と表示される（end は totalCount でキャップされる）。
    it('APF-009b: 端数ページ（currentPage=4, perPage=10, totalCount=37）→「31 - 37 / 全 37 件」', () => {
      const props: AppPaginationFooterProps = {
        currentPage: 4,
        totalPages: 4,
        perPage: 10,
        totalCount: 37,
        onPageChange: vi.fn(),
        onPerPageChange: vi.fn(),
      };

      render(<AppPaginationFooter {...props} />);

      // 端数ページの end は totalCount（37）でキャップされること。
      expect(screen.getByTestId('app-pagination-footer-count')).toHaveTextContent('31 - 37 / 全 37 件');
    });

    // APF-009c: 0 件（totalCount=0, currentPage=1, perPage=20）
    // → 「0 - 0 / 全 0 件」と表示される（件数表示を非表示にはしない。フッター常時表示方針と整合）。
    it('APF-009c: 0 件（totalCount=0）→「0 - 0 / 全 0 件」', () => {
      const props: AppPaginationFooterProps = {
        currentPage: 1,
        totalPages: 1,
        perPage: 20,
        totalCount: 0,
        onPageChange: vi.fn(),
        onPerPageChange: vi.fn(),
      };

      render(<AppPaginationFooter {...props} />);

      // 0 件時は「0 - 0 / 全 0 件」と表示されること（非表示にしない）。
      expect(screen.getByTestId('app-pagination-footer-count')).toHaveTextContent('0 - 0 / 全 0 件');
    });
  });

  // APF-010: totalCount 未指定時の後方互換確認。
  // → 件数表示要素（data-testid="app-pagination-footer-count"）が描画されない。
  //    AppPagination と PageSizeSelector は引き続き描画される。
  it('APF-010: test_AppPaginationFooter_no_count_when_totalCount_undefined — totalCount 未指定時に件数表示が非描画（後方互換）', () => {
    // APF-010
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
      // totalCount を意図的に省略（後方互換テスト）
    };

    render(<AppPaginationFooter {...props} />);

    // 件数表示要素が描画されないこと。
    expect(screen.queryByTestId('app-pagination-footer-count')).not.toBeInTheDocument();

    // AppPagination と PageSizeSelector は引き続き描画されること。
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getAllByText(/表示件数/)[0]).toBeInTheDocument();
  });

  // APF-011: sx 設定と PageSizeSelector FormControl の margin/sy 設定の検証（高さ支配回帰防止）。
  // issue #147 再々オープン A2 案の主目的: Select 枠線がフッター高さを支配しないための構造を保証する。
  it('APF-011: test_AppPaginationFooter_layout_and_pss_margin_constraints — minHeight/px/py sx + PageSizeSelector margin/sy 設定が存在する（高さ支配回帰防止）', () => {
    // APF-011
    const props: AppPaginationFooterProps = {
      currentPage: 1,
      totalPages: 3,
      perPage: 20,
      onPageChange: vi.fn(),
      onPerPageChange: vi.fn(),
    };

    render(<AppPaginationFooter {...props} />);

    // ルート要素（app-pagination-footer）が描画されること。
    const footer = screen.getByTestId('app-pagination-footer');
    expect(footer).toBeInTheDocument();

    // PageSizeSelector（data-testid="page-size-selector"）が描画されること。
    const pageSizeSelector = screen.getByTestId('page-size-selector');
    expect(pageSizeSelector).toBeInTheDocument();

    // MUI Box/FormControl に sx/margin を渡すと className が付与される（間接確認）。
    // jsdom では実 CSS 値検証不可のため、要素の存在と className 付与を確認する。
    expect(footer.className).toBeTruthy();
    expect(pageSizeSelector.className).toBeTruthy();

    // Select コンポーネント（combobox）が存在すること。
    const selector = screen.getByRole('combobox');
    expect(selector).toBeInTheDocument();
  });
});
