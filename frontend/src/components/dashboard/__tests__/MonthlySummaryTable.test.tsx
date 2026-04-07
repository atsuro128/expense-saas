// MonthlySummaryTable コンポーネントのユニットテスト。
// DSH-FE-022〜DSH-FE-026 に対応する。

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MonthlySummaryTable from '../MonthlySummaryTable';

// FE テスト用フィクスチャ。
const mockMonthlySummary = [
  { yearMonth: '2026-04', totalAmount: 150000 },
  { yearMonth: '2026-03', totalAmount: 120000 },
  { yearMonth: '2026-02', totalAmount: 80000 },
];

describe('MonthlySummaryTable', () => {
  // DSH-FE-022: 3 件のデータで 3 行のテーブルが表示され、年月カラムと金額カラムが存在すること。
  it('DSH-FE-022: 3 件のデータで 3 行が表示され、年月・合計金額カラムが存在する', () => {
    render(<MonthlySummaryTable items={mockMonthlySummary} />);

    // テーブルヘッダーが表示されること。
    expect(screen.getByText('年月')).toBeInTheDocument();
    expect(screen.getByText('合計金額')).toBeInTheDocument();

    // 3 行のデータ行が表示されること（テーブル行で確認）。
    const rows = screen.getAllByRole('row');
    // ヘッダー行 + データ 3 行 = 4 行。
    expect(rows.length).toBe(4);
  });

  // DSH-FE-023: 金額が「¥150,000」形式で表示されること。
  it('DSH-FE-023: 金額が「¥150,000」形式で表示される', () => {
    render(
      <MonthlySummaryTable items={[{ yearMonth: '2026-04', totalAmount: 150000 }]} />,
    );
    expect(screen.getByText('¥150,000')).toBeInTheDocument();
  });

  // DSH-FE-024: 年月が「2026年4月」形式で表示されること。
  it('DSH-FE-024: 年月が「2026年4月」形式で表示される', () => {
    render(
      <MonthlySummaryTable items={[{ yearMonth: '2026-04', totalAmount: 100000 }]} />,
    );
    expect(screen.getByText('2026年4月')).toBeInTheDocument();
  });

  // DSH-FE-025: 最新月（2026年4月）が最上行に表示されること（降順）。
  it('DSH-FE-025: 最新月（2026年4月）が最上行に表示される', () => {
    render(<MonthlySummaryTable items={mockMonthlySummary} />);

    const rows = screen.getAllByRole('row');
    // rows[0] はヘッダー行。rows[1] が最初のデータ行。
    expect(rows[1]).toHaveTextContent('2026年4月');
  });

  // DSH-FE-026: 空配列を渡したときデータなしの表示になること。
  it('DSH-FE-026: items が空配列のときデータなし表示になる', () => {
    render(<MonthlySummaryTable items={[]} />);
    expect(screen.getByText('データがありません')).toBeInTheDocument();
    // テーブル要素が存在しないこと。
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
