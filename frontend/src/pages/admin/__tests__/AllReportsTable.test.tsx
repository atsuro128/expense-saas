// AllReportsTable のユニットテスト。
// TNT-FE-030〜034, TNT-FE-052, TNT-FE-053 に対応する。

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';

// MUI X の ESM import 解決問題を回避するため、共通コンポーネントをモックする。
// onRowClick は GridRowParams 互換で { row: rowData } 形式で呼び出す。
// slots.noRowsOverlay を rows が空のとき描画する（issue #147 Q3: フッター非表示仕様撤廃 + noRowsOverlay 対応）。
// slots.footer を受け取り DataGrid フッターコンテナ相当の div 内で描画する（issue #147 再オープン D-1 検証用）。
vi.mock('../../../components/ui/AppDataGrid', () => ({
  default: (props: {
    rows: unknown[];
    columns: unknown[];
    onRowClick?: (params: { row: unknown }) => void;
    loading?: boolean;
    slots?: { footer?: () => React.ReactNode; noRowsOverlay?: () => React.ReactNode };
  }) => {
    if (props.loading) return <div data-testid="app-data-grid-loading">Loading...</div>;
    return (
      <div>
        <table data-testid="app-data-grid">
          <tbody>
            {(props.rows as Array<{ id: string; title: string; submitter_name: string; total_amount: number; status: string; submitted_at: string | null }>).map((row) => (
              <tr key={row.id} onClick={() => props.onRowClick?.({ row })} data-testid={`row-${row.id}`}>
                <td>{row.submitter_name}</td>
                <td>{row.title}</td>
                <td>{`¥${row.total_amount.toLocaleString()}`}</td>
                <td>{row.status}</td>
                <td>{row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('ja-JP') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* rows が 0 件のとき noRowsOverlay を描画する（MuiDataGrid-overlayWrapper 相当） */}
        {props.rows.length === 0 && props.slots?.noRowsOverlay && (
          <div data-testid="datagrid-no-rows-overlay">
            {props.slots.noRowsOverlay()}
          </div>
        )}
        {/* DataGrid フッターコンテナ相当: slots.footer をここで描画する（issue #147 再オープン D-1 テスト用） */}
        {props.slots?.footer && (
          <div className="MuiDataGrid-footerContainer" data-testid="datagrid-footer-container">
            {props.slots.footer()}
          </div>
        )}
      </div>
    );
  },
}));
vi.mock('../../../components/ui/StatusChip', () => ({
  default: (props: { status: string }) => <span data-testid="status-chip">{props.status}</span>,
}));
vi.mock('../../../components/ui/EmptyState', () => ({
  default: (props: { message: string }) => <div data-testid="empty-state">{props.message}</div>,
}));
vi.mock('../../../components/ui/PageSkeleton', () => ({
  default: (props: { variant: string }) => <div data-testid={`page-skeleton-${props.variant}`}>Loading...</div>,
}));

import AllReportsTable from '../AllReportsTable';
import type { AllReportRow } from '../../../api/adminTypes';

// テスト用レポートデータ。openapi.yaml ExpenseReportSummary に準拠した snake_case プロパティを使用する。
const mockReport: AllReportRow = {
  id: 'rpt-1',
  title: '出張費',
  submitter: { id: 'u1', name: 'User1' },
  total_amount: 10000,
  status: 'submitted',
  submitted_at: '2025-01-15T00:00:00Z',
  created_at: '2025-01-10T00:00:00Z',
};

describe('AllReportsTable', () => {
  let mockOnRowClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnRowClick = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TNT-FE-030: レポート行が正しく描画されること。
  // AppDataGrid モックは全フィールドを td で描画する。
  // StatusChip モックはステータス値（英語）をそのまま表示する。
  it('TNT-FE-030: レポートデータが渡されたとき各列の値が描画される', () => {
    render(
      <AllReportsTable
        reports={[mockReport]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={mockOnRowClick}
      />
    );

    // 申請者名が表示されること（submitter_name としてフラット化）。
    expect(screen.getByText('User1')).toBeInTheDocument();

    // タイトルが表示されること。
    expect(screen.getByText('出張費')).toBeInTheDocument();

    // 合計金額が ¥ プレフィックス付きで表示されること。
    expect(screen.getByText('¥10,000')).toBeInTheDocument();

    // ステータスが表示されること（StatusChip モックはステータス値をそのまま表示）。
    expect(screen.getByText('submitted')).toBeInTheDocument();

    // 提出日が表示されること。
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  // TNT-FE-031: loading = true の場合、PageSkeleton（variant="table"）が描画されること。
  // AllReportsTable は loading=true のとき PageSkeleton を直接返す（外側 div なし）。
  // PageSkeleton モックは data-testid="page-skeleton-table" を付与する。
  it('TNT-FE-031: loading = true のとき PageSkeleton が描画される', () => {
    render(
      <AllReportsTable
        reports={[]}
        loading={true}
        hasActiveFilters={false}
        onRowClick={mockOnRowClick}
      />
    );

    // PageSkeleton モック（data-testid="page-skeleton-table"）が描画されること。
    expect(screen.getByTestId('page-skeleton-table')).toBeInTheDocument();

    // データグリッドとテーブル行が表示されないこと。
    expect(screen.queryByTestId('app-data-grid')).not.toBeInTheDocument();
  });

  // TNT-FE-032: データ 0 件・フィルタなしの場合、AppDataGrid の noRowsOverlay として EmptyState が表示される（issue #147 Q3 対応）。
  // 早期 return を撤去したため AppDataGrid は常に描画され、noRowsOverlay 経由で EmptyState が表示される。
  it('TNT-FE-032: データ 0 件・フィルタなし（hasActiveFilters=false）のとき EmptyState が AppDataGrid の noRowsOverlay として「レポートはまだ作成されていません。」で表示される', () => {
    render(
      <AllReportsTable
        reports={[]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={mockOnRowClick}
      />
    );

    // AppDataGrid が描画されること（早期 return が撤去されたため）。
    expect(screen.getByTestId('app-data-grid')).toBeInTheDocument();

    // noRowsOverlay 経由で EmptyState が表示されること。
    expect(screen.getByText('レポートはまだ作成されていません。')).toBeInTheDocument();
  });

  // TNT-FE-033: データ 0 件・フィルタありの場合、AppDataGrid の noRowsOverlay として EmptyState が表示される（issue #147 Q3 対応）。
  it('TNT-FE-033: データ 0 件・フィルタあり（hasActiveFilters=true）のとき EmptyState が AppDataGrid の noRowsOverlay として「条件に一致するレポートはありません。フィルタを変更してお試しください。」で表示される', () => {
    render(
      <AllReportsTable
        reports={[]}
        loading={false}
        hasActiveFilters={true}
        onRowClick={mockOnRowClick}
      />
    );

    // AppDataGrid が描画されること（早期 return が撤去されたため）。
    expect(screen.getByTestId('app-data-grid')).toBeInTheDocument();

    // noRowsOverlay 経由でフィルタあり時のメッセージが表示されること。
    expect(screen.getByText('条件に一致するレポートはありません。フィルタを変更してお試しください。')).toBeInTheDocument();
  });

  // TNT-FE-034: 行クリック時に onRowClick が reportId で呼ばれること。
  // AppDataGrid（MUI DataGrid）の行クリックイベントを使用する。
  it('TNT-FE-034: テーブル行をクリックすると onRowClick が "rpt-1" で呼ばれる', async () => {
    const user = userEvent.setup();

    render(
      <AllReportsTable
        reports={[mockReport]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={mockOnRowClick}
      />
    );

    // DataGrid の行セル（タイトル列）をクリックして行クリックイベントを発火させる。
    await user.click(screen.getByText('出張費'));

    expect(mockOnRowClick).toHaveBeenCalledWith('rpt-1');
  });

  // TNT-FE-052: paginationFooter prop を渡すと DataGrid フッターコンテナ内に描画される（issue #147 再オープン D-1 ②a）。
  it('TNT-FE-052: paginationFooter を渡すと DataGrid フッターコンテナ内に描画される', () => {
    const paginationContent = (
      <div data-testid="mock-pagination-footer">ページネーションフッター</div>
    );

    render(
      <AllReportsTable
        reports={[mockReport]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={mockOnRowClick}
        paginationFooter={paginationContent}
      />
    );

    // DataGrid フッターコンテナ（モック内の MuiDataGrid-footerContainer 相当）が描画されること。
    const footerContainer = screen.getByTestId('datagrid-footer-container');
    expect(footerContainer).toBeInTheDocument();

    // フッターコンテナ内に paginationFooter の内容が描画されること。
    expect(screen.getByTestId('mock-pagination-footer')).toBeInTheDocument();
    expect(screen.getByText('ページネーションフッター')).toBeInTheDocument();
  });

  // TNT-FE-053: 空状態（reports=[]）でも paginationFooter が描画される（issue #147 Q3 リグレッション防止）。
  // 早期 return を撤去したため、空状態でも AppDataGrid が描画され slots.footer（paginationFooter）が常時表示される。
  it('TNT-FE-053: reports=[] かつ paginationFooter を渡すと EmptyState とフッターが同時に描画される', () => {
    const paginationContent = (
      <div data-testid="mock-pagination-footer">ページネーションフッター</div>
    );

    render(
      <AllReportsTable
        reports={[]}
        loading={false}
        hasActiveFilters={false}
        onRowClick={mockOnRowClick}
        paginationFooter={paginationContent}
      />
    );

    // AppDataGrid が描画されること（空状態でも早期 return しない）。
    expect(screen.getByTestId('app-data-grid')).toBeInTheDocument();

    // noRowsOverlay 経由で EmptyState が表示されること。
    expect(screen.getByText('レポートはまだ作成されていません。')).toBeInTheDocument();

    // 空状態でも DataGrid フッターコンテナ（paginationFooter）が描画されること（Q3 要件）。
    expect(screen.getByTestId('datagrid-footer-container')).toBeInTheDocument();
    expect(screen.getByTestId('mock-pagination-footer')).toBeInTheDocument();
  });
});
