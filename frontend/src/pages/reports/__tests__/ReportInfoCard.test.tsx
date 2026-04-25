// ReportInfoCard コンポーネントのユニットテスト。
// RPT-FE-070、RPT-FE-108-A / RPT-FE-109-A に対応する。
// RPT-FE-108-A / RPT-FE-109-A は ReportBasicInfo.test.tsx の RPT-FE-108 / RPT-FE-109 と
// 同等の検証を、実画面で実際に描画される ReportInfoCard 経由で再確認するためのもの
// （issue #144 / codex 指摘 PR #94 対応。ReportDetailPage が ReportInfoCard を直接使用しているため）。

import { render, screen } from '@testing-library/react';
import ReportInfoCard from '../ReportInfoCard';
import type { ExpenseReportDetail } from '../../../api/types';

const draftReport: ExpenseReportDetail = {
  id: 'report-001',
  title: '出張費テスト',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
  status: 'draft',
  total_amount: 50000,
  submitter: { id: 'user-001', name: 'テストユーザー' },
  items: [],
  created_at: '2026-04-23T15:56:00+09:00',
  updated_at: '2026-04-23T15:56:00+09:00',
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

  // RPT-FE-108-A: ReportInfoCard 経由で常時表示 4 項目（対象期間・合計金額・作成者・作成日）の
  // ラベルが UI に出現することを検証（実画面の描画経路を直接保証する）。
  it('RPT-FE-108-A: ReportInfoCard 経由で対象期間・合計金額・作成者・作成日のラベルが UI 上に出現する', () => {
    render(<ReportInfoCard report={draftReport} />);

    expect(screen.getByText(/対象期間:/)).toBeInTheDocument();
    expect(screen.getByText(/合計金額:/)).toBeInTheDocument();
    expect(screen.getByText(/作成者:/)).toBeInTheDocument();
    expect(screen.getByText(/作成日:/)).toBeInTheDocument();
  });

  // RPT-FE-109-A: ReportInfoCard 経由で作成日が YYYY/MM/DD HH:mm 形式（時刻付き）で
  // 表示されることを検証。
  it('RPT-FE-109-A: ReportInfoCard 経由で作成日が YYYY/MM/DD HH:mm 形式で表示される', () => {
    render(<ReportInfoCard report={draftReport} />);

    // 時刻付きフォーマット（2026/04/23 15:56）が表示されること
    expect(screen.getByText(/作成日:.*2026\/04\/23 15:56/)).toBeInTheDocument();
    const createdAtElement = screen.getByText(/作成日:/);
    expect(createdAtElement.textContent).toMatch(/2026\/04\/23 15:56/);
  });
});
