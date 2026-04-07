// RecentReportList コンポーネントのユニットテスト。
// DSH-FE-027〜DSH-FE-029 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import RecentReportList from '../RecentReportList';
import type { RecentReport } from '../RecentReportList';

/** 直近レポートのモックデータ（5 件）。 */
const mockRecentReports: RecentReport[] = [
  { id: 'rpt-001', title: '4月交通費', periodStart: '2026-04-01', periodEnd: '2026-04-30', totalAmount: 15000, status: 'draft' },
  { id: 'rpt-002', title: '3月宿泊費', periodStart: '2026-03-01', periodEnd: '2026-03-31', totalAmount: 25000, status: 'submitted' },
  { id: 'rpt-003', title: '2月飲食費', periodStart: '2026-02-01', periodEnd: '2026-02-28', totalAmount: 10000, status: 'approved' },
  { id: 'rpt-004', title: '1月消耗品費', periodStart: '2026-01-01', periodEnd: '2026-01-31', totalAmount: 5000, status: 'rejected' },
  { id: 'rpt-005', title: '12月通信費', periodStart: '2025-12-01', periodEnd: '2025-12-31', totalAmount: 8000, status: 'paid' },
];

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RecentReportList', () => {
  // DSH-FE-027: 5 件のレポート行が表示されること。
  it('DSH-FE-027: 5 件のレポートタイトルが表示される', () => {
    renderWithRouter(<RecentReportList reports={mockRecentReports} />);
    expect(screen.getByText('4月交通費')).toBeInTheDocument();
    expect(screen.getByText('3月宿泊費')).toBeInTheDocument();
    expect(screen.getByText('2月飲食費')).toBeInTheDocument();
    expect(screen.getByText('1月消耗品費')).toBeInTheDocument();
    expect(screen.getByText('12月通信費')).toBeInTheDocument();
  });

  // DSH-FE-028: 空配列のとき EmptyState が表示されること。
  it('DSH-FE-028: reports が空配列のとき EmptyState が表示される', () => {
    renderWithRouter(<RecentReportList reports={[]} />);
    expect(
      screen.getByText('経費レポートはまだありません。レポートを作成して経費精算を始めましょう。'),
    ).toBeInTheDocument();
  });

  // DSH-FE-029: 「すべてのレポートを見る」リンクが /reports に遷移すること。
  it('DSH-FE-029: 「すべてのレポートを見る」リンクが /reports に遷移する', () => {
    renderWithRouter(<RecentReportList reports={mockRecentReports} />);
    const link = screen.getByText('すべてのレポートを見る').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/reports');
  });
});
