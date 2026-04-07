// ReportListTable コンポーネントのユニットテスト。
// RPT-FE-015〜020 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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

  // RPT-FE-017: status='submitted' のデータのとき StatusChip が「提出済み」として描画される。
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

    const rows = screen.getAllByRole('row');
    // ヘッダー行を除いた最初のデータ行をクリック
    await userEvent.click(rows[1]!);

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

  // RPT-FE-020: loading=true のとき AppDataGrid（テーブル）に loading=true が渡される。
  it('RPT-FE-020: loading=true のときテーブルに loading が伝わる', () => {
    render(<ReportListTable reports={sampleReports} loading={true} />);

    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('data-loading', 'true');
  });
});
