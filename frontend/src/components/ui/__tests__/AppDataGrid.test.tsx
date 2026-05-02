// AppDataGrid の単体テスト。
// ADG-001〜007 に対応する（issue #147 再オープン D-1 対応 PR #102 追加テスト、
// ADG-005a/b / ADG-006 は issue #154 / #160 対応、ADG-007 は issue #160 再対応）。
// AppDataGrid の slots 合成挙動（{...rest} 展開順序修正後）を検証する。
//
// Traceability: 新規接頭辞 ADG- を新設（既存ドキュメントに ADG- 採番なし）
// ADG-001 → 'ADG-001: デフォルト noRowsOverlay が emptyMessage を表示する'
// ADG-002 → 'ADG-002: slots.footer を渡すとフッターが描画され、デフォルト noRowsOverlay も保持される'
// ADG-003 → 'ADG-003: slots.noRowsOverlay を渡すと呼び出し側の実装で AppDataGrid デフォルトを上書きする'
// ADG-004 → 'ADG-004: slots.footer と slots.noRowsOverlay を同時に渡すと両方が描画される'
// ADG-005a → 'ADG-005a: rows=[] 時に DataGrid に minHeight: 361 が適用される'
// ADG-005b → 'ADG-005b: rows>0 時に DataGrid に minHeight が適用されない'（余白防止）
// ADG-006 → 'ADG-006: ルート Box に overflowX: auto が適用される'
// ADG-007 → '#160 再対応: AppDataGrid Box に minWidth: 0 が渡されている'
//
// MUI X DataGrid の ESM import 解決問題を回避するため @mui/x-data-grid をモックする。
// モックは slots / rows / loading を受け取り、MUI DataGrid の動作を最小限再現する。
//
// @mui/material/Box もモックする（ADG-006 / ADG-007 回帰防止）。
// MUI Box の sx は Emotion により動的 CSS クラスに変換されるため jsdom では
// getComputedStyle / toHaveStyle による sx 値の検証が不安定である。
// Box モックは sx の overflowX / minWidth を data-* 属性として展開し、
// テストが実値を直接アサートできるようにする。

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// @mui/material/Box をモックする。
// sx の overflowX を data-overflow-x 属性に展開することで ADG-006 の実値検証を可能にする。
// sx の minWidth を data-min-width 属性に展開することで ADG-007 の実値検証を可能にする。
// data-testid="appdatagrid-root" を設定し、ルート要素を特定できるようにする。
vi.mock('@mui/material/Box', () => ({
  default: ({
    children,
    sx,
    ...rest
  }: {
    children?: React.ReactNode;
    sx?: Record<string, unknown>;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="appdatagrid-root"
      data-overflow-x={typeof sx?.overflowX === 'string' ? sx.overflowX : undefined}
      data-min-width={sx?.minWidth !== undefined ? String(sx.minWidth) : undefined}
      {...rest}
    >
      {children}
    </div>
  ),
}));

// @mui/x-data-grid をモックする。
// DataGrid は slots.noRowsOverlay（rows が空のとき）と slots.footer を描画する最小実装。
// GridColDef / DataGridProps は実際の型シグネチャと互換性を持つよう定義する。
// ADG-005a/b 検証のため sx の minHeight を data-min-height 属性として実値展開する
//（undefined の場合は属性を出力しない）。
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: (props: {
    rows: unknown[];
    columns: unknown[];
    loading?: boolean;
    slots?: {
      noRowsOverlay?: () => React.ReactNode;
      footer?: () => React.ReactNode;
    };
    hideFooterPagination?: boolean;
    disableRowSelectionOnClick?: boolean;
    localeText?: unknown;
    onRowClick?: (params: unknown) => void;
    sx?: Record<string, unknown>;
  }) => {
    if (props.loading) {
      return <div data-testid="datagrid-loading">Loading...</div>;
    }
    return (
      // data-min-height: sx.minHeight の実値を展開する（ADG-005a/b 検証用）。
      // minHeight が undefined のとき属性を出力しない（属性なし = minHeight 未設定）。
      <div
        data-testid="datagrid-root"
        {...(typeof props.sx?.minHeight === 'number'
          ? { 'data-min-height': String(props.sx.minHeight) }
          : {})}
      >
        {/* rows が 0 件のとき noRowsOverlay を描画する（DataGrid の MuiDataGrid-overlayWrapper 相当） */}
        {props.rows.length === 0 && props.slots?.noRowsOverlay && (
          <div data-testid="datagrid-no-rows-overlay">
            {props.slots.noRowsOverlay()}
          </div>
        )}
        {/* rows がある場合はシンプルなリスト表示 */}
        {props.rows.length > 0 && (
          <ul data-testid="datagrid-rows">
            {(props.rows as Array<{ id: string }>).map((row) => (
              <li key={row.id} data-testid={`datagrid-row-${row.id}`}>
                {row.id}
              </li>
            ))}
          </ul>
        )}
        {/* DataGrid フッターコンテナ相当: slots.footer を常時描画する */}
        {props.slots?.footer && (
          <div data-testid="datagrid-footer-container">
            {props.slots.footer()}
          </div>
        )}
      </div>
    );
  },
  jaJP: {
    components: {
      MuiDataGrid: {
        defaultProps: {
          localeText: {},
        },
      },
    },
  },
}));

import AppDataGrid from '../AppDataGrid';
import type { GridColDef } from '@mui/x-data-grid';

/** テスト用のカラム定義（最低限のフィールドのみ） */
const TEST_COLUMNS: GridColDef[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: '名前' },
];

describe('AppDataGrid', () => {
  beforeEach(() => {
    // 各テスト前のセットアップは不要。vi.mock はファイルレベルで適用済み。
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ADG-001: emptyMessage="テストメッセージ" を渡し、rows=[] で slots を渡さない場合、
  // AppDataGrid デフォルトの noRowsOverlay がテストメッセージを表示すること。
  it('ADG-001: デフォルト noRowsOverlay が emptyMessage を表示する', () => {
    // ADG-001
    render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="テストメッセージ"
      />,
    );

    // DataGrid の noRowsOverlay エリアが描画されること。
    expect(screen.getByTestId('datagrid-no-rows-overlay')).toBeInTheDocument();

    // AppDataGrid デフォルトの emptyMessage "テストメッセージ" が表示されること。
    expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
  });

  // ADG-002: slots={{ footer: () => <div data-testid="custom-footer">FOOTER</div> }} を渡し、
  // rows に 2 件のデータがある場合:
  //   - footer が表示される
  //   - デフォルト noRowsOverlay は rows が空でないため描画されない（rows>0 のため仕様通り）
  // また rows=[] のときも footer が表示され、デフォルト noRowsOverlay も両立すること。
  it('ADG-002: slots.footer を渡すとフッターが描画され、デフォルト noRowsOverlay も保持される', () => {
    // ADG-002
    // rows=[] + slots.footer の組み合わせで両方が描画されることを検証する。
    const CustomFooter = () => <div data-testid="custom-footer">FOOTER</div>;

    render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="空です"
        slots={{ footer: CustomFooter }}
      />,
    );

    // DataGrid の noRowsOverlay エリアが描画されること（AppDataGrid デフォルトが保持されること）。
    expect(screen.getByTestId('datagrid-no-rows-overlay')).toBeInTheDocument();

    // デフォルト emptyMessage が表示されること。
    expect(screen.getByText('空です')).toBeInTheDocument();

    // slots.footer で渡した CustomFooter が DataGrid フッターコンテナ内に描画されること。
    const footerContainer = screen.getByTestId('datagrid-footer-container');
    expect(footerContainer).toBeInTheDocument();
    expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
    expect(screen.getByTestId('custom-footer')).toHaveTextContent('FOOTER');
  });

  // ADG-003: slots={{ noRowsOverlay: () => <div data-testid="custom-empty">カスタム空</div> }} を渡し、
  // rows=[] の場合、呼び出し側の noRowsOverlay がデフォルトを上書きすること。
  // つまり "データがありません"（デフォルト）ではなく "カスタム空" が表示されること。
  it('ADG-003: slots.noRowsOverlay を渡すと呼び出し側の実装で AppDataGrid デフォルトを上書きする', () => {
    // ADG-003
    const CustomEmpty = () => <div data-testid="custom-empty">カスタム空</div>;

    render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="デフォルトメッセージ"
        slots={{ noRowsOverlay: CustomEmpty }}
      />,
    );

    // noRowsOverlay エリアが描画されること。
    expect(screen.getByTestId('datagrid-no-rows-overlay')).toBeInTheDocument();

    // 呼び出し側の CustomEmpty が描画されること。
    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
    expect(screen.getByTestId('custom-empty')).toHaveTextContent('カスタム空');

    // AppDataGrid デフォルトの emptyMessage は表示されないこと（上書きされているため）。
    expect(screen.queryByText('デフォルトメッセージ')).not.toBeInTheDocument();
  });

  // ADG-005a: rows=[] のとき DataGrid に minHeight: 361 が適用される。
  // EmptyState（アクションボタン付き）が画面内に収まり、アクションボタンと AppPaginationFooter の間に
  // 視覚的な余白を確保する最小高さを設定する。
  it('ADG-005a: rows=[] 時に DataGrid に minHeight: 361 が適用される', () => {
    // ADG-005a
    render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="空です"
      />,
    );

    // DataGrid モックが data-min-height="361" を持つこと（sx.minHeight の実値検証）。
    expect(screen.getByTestId('datagrid-root')).toHaveAttribute('data-min-height', '361');
  });

  // ADG-005b: rows に 1 件以上ある場合、DataGrid に minHeight が適用されない（余白防止）。
  // DataGrid の自然高さに任せることでテーブル末尾に不要な余白が生じないようにする。
  it('ADG-005b: rows>0 時に DataGrid に minHeight が適用されない', () => {
    // ADG-005b
    render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[{ id: '1', name: 'テスト' }]}
      />,
    );

    // DataGrid モックが data-min-height 属性を持たないこと（sx.minHeight = undefined）。
    expect(screen.getByTestId('datagrid-root')).not.toHaveAttribute('data-min-height');
  });

  // ADG-006: ルート Box に overflowX: 'auto' が適用されている（issue #160 対応）。
  // 列幅合計が画面幅を超える場合に横スクロールを許可するための設定。
  // @mui/material/Box をモックして sx.overflowX を data-overflow-x 属性に展開し、
  // AppDataGrid が overflowX: 'auto' を渡していることを直接検証する。
  it('ADG-006: ルート Box に overflowX: auto が適用される', () => {
    // ADG-006
    // Box モックは sx.overflowX を data-overflow-x 属性として出力するため、
    // overflowX: 'auto' が渡された Box を属性セレクタで特定できる。
    // AppDataGrid が sx={{ overflowX: 'auto' }} を渡していることをここで検証する。
    // この検証により、AppDataGrid.tsx から overflowX: 'auto' を削除すると FAIL する。
    const { container } = render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="空です"
      />,
    );
    // data-overflow-x="auto" を持つ要素が DOM 内に存在することを検証する。
    // querySelectorAll で属性値を直接検索する（Box モックの data-overflow-x 属性）。
    const overflowBoxes = container.querySelectorAll('[data-overflow-x="auto"]');
    expect(overflowBoxes.length).toBeGreaterThanOrEqual(1);
  });

  // ADG-007: ルート Box に minWidth: 0 が適用されている（issue #160 再対応）。
  // 親が display: flex の場合、flex item の min-width 既定値 auto によって Box が
  // コンテンツ幅（726px）に追従して膨張し overflowX: 'auto' が発火しない CSS Flexbox の罠を回避する。
  // @mui/material/Box をモックして sx.minWidth を data-min-width 属性に展開し、
  // AppDataGrid が minWidth: 0 を渡していることを直接検証する。
  // jsdom 環境では実際の Flexbox レイアウト挙動は再現できないが、
  // 「sx に minWidth: 0 が渡される」事実を回帰防止として固定することが目的。
  it('ADG-007: ルート Box に minWidth: 0 が適用される', () => {
    // ADG-007
    const { container } = render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="空です"
      />,
    );
    // data-min-width="0" を持つ要素が DOM 内に存在することを検証する。
    // querySelectorAll で属性値を直接検索する（Box モックの data-min-width 属性）。
    const minWidthBoxes = container.querySelectorAll('[data-min-width="0"]');
    expect(minWidthBoxes.length).toBeGreaterThanOrEqual(1);
  });

  // ADG-004: slots.footer と slots.noRowsOverlay の両方を渡し、rows=[] の場合:
  //   - 呼び出し側の noRowsOverlay（CustomEmpty）が描画される
  //   - 呼び出し側の footer（CustomFooter）も描画される
  //   - 両方が同時に描画されること。
  it('ADG-004: slots.footer と slots.noRowsOverlay を同時に渡すと両方が描画される', () => {
    // ADG-004
    const CustomEmpty = () => <div data-testid="custom-empty-both">CUSTOM_EMPTY</div>;
    const CustomFooter = () => <div data-testid="custom-footer-both">CUSTOM_FOOTER</div>;

    render(
      <AppDataGrid
        columns={TEST_COLUMNS}
        rows={[]}
        emptyMessage="デフォルトメッセージ"
        slots={{ noRowsOverlay: CustomEmpty, footer: CustomFooter }}
      />,
    );

    // noRowsOverlay エリアが描画されること。
    expect(screen.getByTestId('datagrid-no-rows-overlay')).toBeInTheDocument();

    // 呼び出し側の CustomEmpty が描画されること。
    expect(screen.getByTestId('custom-empty-both')).toBeInTheDocument();
    expect(screen.getByTestId('custom-empty-both')).toHaveTextContent('CUSTOM_EMPTY');

    // AppDataGrid デフォルトの emptyMessage は表示されないこと（CustomEmpty で上書きされているため）。
    expect(screen.queryByText('デフォルトメッセージ')).not.toBeInTheDocument();

    // フッターコンテナが描画されること。
    expect(screen.getByTestId('datagrid-footer-container')).toBeInTheDocument();

    // 呼び出し側の CustomFooter が描画されること。
    expect(screen.getByTestId('custom-footer-both')).toBeInTheDocument();
    expect(screen.getByTestId('custom-footer-both')).toHaveTextContent('CUSTOM_FOOTER');
  });
});
