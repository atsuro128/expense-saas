// RecentReportRow コンポーネントのユニットテスト。
// DSH-FE-030〜DSH-FE-033 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import RecentReportRow from '../RecentReportRow';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';

/** RecentReportRow は TableRow のため、Table > TableBody でラップする。 */
function renderRow(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <Table>
        <TableBody>{ui}</TableBody>
      </Table>
    </MemoryRouter>,
  );
}

describe('RecentReportRow', () => {
  // DSH-FE-030: タイトルがリンクとして表示され、/reports/{id} に遷移すること。
  it('DSH-FE-030: タイトルがリンクとして表示され、/reports/uuid-001 に遷移する', () => {
    renderRow(
      <RecentReportRow
        id="uuid-001"
        title="4月交通費"
        periodStart="2026-04-01"
        periodEnd="2026-04-30"
        totalAmount={15000}
        status="draft"
      />,
    );
    const link = screen.getByText('4月交通費').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/reports/uuid-001');
  });

  // DSH-FE-031: 対象期間が表示されること。
  it('DSH-FE-031: 対象期間が「2026/04/01 - 2026/04/30」形式で表示される', () => {
    renderRow(
      <RecentReportRow
        id="uuid-001"
        title="テスト"
        periodStart="2026-04-01"
        periodEnd="2026-04-30"
        totalAmount={10000}
        status="draft"
      />,
    );
    // 「2026/04/01 - 2026/04/30」という形式で表示されること。
    expect(screen.getByText(/2026\/04\/01/)).toBeInTheDocument();
    expect(screen.getByText(/2026\/04\/30/)).toBeInTheDocument();
  });

  // DSH-FE-032: 金額が「¥150,000」形式で表示されること。
  it('DSH-FE-032: 合計金額が「¥150,000」形式で表示される', () => {
    renderRow(
      <RecentReportRow
        id="uuid-001"
        title="テスト"
        periodStart="2026-04-01"
        periodEnd="2026-04-30"
        totalAmount={150000}
        status="draft"
      />,
    );
    expect(screen.getByText('¥150,000')).toBeInTheDocument();
  });

  // DSH-FE-033: StatusChip が status="submitted" で描画され「提出済み」と表示されること。
  it('DSH-FE-033: status="submitted" のとき StatusChip が「提出済み」と表示される', () => {
    renderRow(
      <RecentReportRow
        id="uuid-001"
        title="テスト"
        periodStart="2026-04-01"
        periodEnd="2026-04-30"
        totalAmount={10000}
        status="submitted"
      />,
    );
    expect(screen.getByText('提出済み')).toBeInTheDocument();
  });
});
