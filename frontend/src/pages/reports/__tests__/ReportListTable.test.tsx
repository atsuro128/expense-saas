// ReportListTable コンポーネントのユニットテスト。
// RPT-FE-015〜020, RPT-FE-147-01 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// MUI X の ESM import 解決問題を回避するため AppDataGrid をモックする。
// onRowClick は { row: rowData } 形式で呼び出す。
// slots.footer を受け取り DataGrid フッターコンテナ相当の div 内で描画する（issue #147 再オープン D-1 検証用）。
vi.mock('../../../components/ui/AppDataGrid', () => ({
  default: (props: {
    rows: Array<{ id: string; title: string; period: string; totalAmount: number; status: string; createdAt: string; periodStart: string; periodEnd: string }>;
    columns: unknown[];
    onRowClick?: (params: { row: unknown }) => void;
    loading?: boolean;
    slots?: { footer?: () => React.ReactNode };
  }) => {
    if (props.loading) return <div data-testid="app-data-grid-loading">Loading...</div>;
    return (
      <div>
        <table data-testid="app-data-grid">
          <thead>
            <tr>
              <th>タイトル</th>
              <th>対象期間</th>
              <th>合計金額</th>
              <th>ステータス</th>
              <th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => props.onRowClick?.({ row })}
                data-testid={`row-${row.id}`}
              >
                <td>{row.title}</td>
                <td>{`${row.periodStart} 〜 ${row.periodEnd}`}</td>
                <td>{row.totalAmount.toLocaleString()}</td>
                <td>{row.status}</td>
                <td>{row.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

import React from 'react';

// StatusChip をモックする。
vi.mock('../../../components/ui/StatusChip', () => ({
  default: (props: { status: string }) => <span data-testid="status-chip">{props.status}</span>,
}));

// EmptyState をモックする。
vi.mock('../../../components/ui/EmptyState', () => ({
  default: (props: { message: string; action?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      <p>{props.message}</p>
      {props.action && (
        <button onClick={props.action.onClick}>{props.action.label}</button>
      )}
    </div>
  ),
}));

import ReportListTable from '../ReportListTable';
import type { ReportListItem } from '../ReportListTable';

const sampleReports: ReportListItem[] = [
  {
    id: 'report-001',
    title: 'テストレポート1',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    totalAmount: 50000,
    status: 'draft',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'report-002',
    title: 'テストレポート2',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    totalAmount: 1234567,
    status: 'submitted',
    createdAt: '2026-03-02T00:00:00Z',
  },
];

describe('ReportListTable', () => {
  // RPT-FE-015: 2 件のデータを渡すとカラム（タイトル・対象期間・合計金額・ステータス・作成日）が描画される。
  it('RPT-FE-015: データを渡すとテーブルのカラムが描画される', () => {
    render(<ReportListTable reports={sampleReports} />);

    expect(screen.getByText('タイトル')).toBeInTheDocument();
    expect(screen.getByText('対象期間')).toBeInTheDocument();
    expect(screen.getByText('合計金額')).toBeInTheDocument();
    expect(screen.getByText('ステータス')).toBeInTheDocument();
    expect(screen.getByText('作成日')).toBeInTheDocument();
  });

  // RPT-FE-016: totalAmount=1234567 のとき「1,234,567」と 3 桁カンマ区切りで表示される。
  it('RPT-FE-016: totalAmount が 3 桁カンマ区切りで表示される', () => {
    render(<ReportListTable reports={sampleReports} />);

    // 1,234,567 が表示されること
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  // RPT-FE-017: status='submitted' のデータのとき StatusChip が描画される。
  it('RPT-FE-017: status=submitted のとき StatusChip が描画される', () => {
    render(<ReportListTable reports={sampleReports} />);

    // submitted ステータスの要素が存在すること
    const submittedChip = screen.getByText('submitted');
    expect(submittedChip).toBeInTheDocument();
  });

  // RPT-FE-018: 行をクリックすると onRowClick がその行の reportId で呼ばれる。
  it('RPT-FE-018: 行をクリックすると onRowClick が reportId で呼ばれる', async () => {
    const onRowClick = vi.fn();
    render(<ReportListTable reports={sampleReports} onRowClick={onRowClick} />);

    // AppDataGrid モックの最初の行をクリックする。
    const row = screen.getByTestId('row-report-001');
    await userEvent.click(row);

    expect(onRowClick).toHaveBeenCalledWith('report-001');
  });

  // RPT-FE-019: reports=[] のとき EmptyState が表示される。
  it('RPT-FE-019: reports=[] のとき EmptyState が表示される', () => {
    const onCreateReport = vi.fn();
    render(<ReportListTable reports={[]} onCreateReport={onCreateReport} />);

    expect(
      screen.getByText(
        '経費レポートはまだありません。レポートを作成して経費精算を始めましょう。',
      ),
    ).toBeInTheDocument();
  });

  // RPT-FE-020: loading=true のとき AppDataGrid に loading=true が渡され、ローディング表示になる。
  it('RPT-FE-020: loading=true のときテーブルに loading が伝わる', () => {
    render(<ReportListTable reports={sampleReports} loading={true} />);

    // AppDataGrid モックが loading=true のとき app-data-grid-loading を描画すること。
    expect(screen.getByTestId('app-data-grid-loading')).toBeInTheDocument();
  });

  // RPT-FE-147-01: paginationFooter prop を渡すと DataGrid フッターコンテナ内に描画される（issue #147 再オープン D-1 ②a）。
  it('RPT-FE-147-01: paginationFooter を渡すと DataGrid フッターコンテナ内に描画される', () => {
    const paginationContent = (
      <div data-testid="mock-pagination-footer">ページネーションフッター</div>
    );

    render(
      <ReportListTable
        reports={sampleReports}
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
});
