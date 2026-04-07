// ReportInfoCard コンポーネントのユニットテスト。
// RPT-FE-070 に対応する。

import { render, screen } from '@testing-library/react';
import ReportInfoCard from '../ReportInfoCard';
import type { ExpenseReportDetail } from '../../../api/types';

const draftReport: ExpenseReportDetail = {
  id: 'report-001',
  title: '出張費テスト',
  period_start: '2026-03-01T00:00:00Z',
  period_end: '2026-03-31T00:00:00Z',
  status: 'draft',
  total_amount: 50000,
  submitter: { id: 'user-001', name: 'テストユーザー' },
  items: [],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

describe('ReportInfoCard', () => {
  // RPT-FE-070: report データを渡すと ReportBasicInfo と ReportWorkflowInfo が描画される。
  it('RPT-FE-070: レポート詳細データを渡すと ReportInfoCard が描画される', () => {
    render(<ReportInfoCard report={draftReport} />);

    // タイトルが表示されること
    expect(screen.getByText('出張費テスト')).toBeInTheDocument();
    // ステータスチップが表示されること
    expect(screen.getByTestId('status-chip')).toBeInTheDocument();
  });
});
