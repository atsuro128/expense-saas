// AppDataGrid の単体テスト。
// ADG-001〜004 に対応する（issue #147 再オープン D-1 対応 PR #102 追加テスト）。
// AppDataGrid の slots 合成挙動（{...rest} 展開順序修正後）を検証する。
//
// Traceability: 新規接頭辞 ADG- を新設（既存ドキュメントに ADG- 採番なし）
// ADG-001 → 'ADG-001: デフォルト noRowsOverlay が emptyMessage を表示する'
// ADG-002 → 'ADG-002: slots.footer を渡すとフッターが描画され、デフォルト noRowsOverlay も保持される'
// ADG-003 → 'ADG-003: slots.noRowsOverlay を渡すと呼び出し側の実装で AppDataGrid デフォルトを上書きする'
// ADG-004 → 'ADG-004: slots.footer と slots.noRowsOverlay を同時に渡すと両方が描画される'
//
// MUI X DataGrid の ESM import 解決問題を回避するため @mui/x-data-grid をモックする。
// モックは slots / rows / loading を受け取り、MUI DataGrid の動作を最小限再現する。

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// @mui/x-data-grid をモックする。
// DataGrid は slots.noRowsOverlay（rows が空のとき）と slots.footer を描画する最小実装。
// GridColDef / DataGridProps は実際の型シグネチャと互換性を持つよう定義する。
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
    sx?: unknown;
  }) => {
    if (props.loading) {
      return <div data-testid="datagrid-loading">Loading...</div>;
    }
    return (
      <div data-testid="datagrid-root">
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

/** テスト用の行データ */
const TEST_ROWS: readonly Record<string, unknown>[] = [
  { id: 'row-001', name: 'テスト行1' },
  { id: 'row-002', name: 'テスト行2' },
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
