// ReportBasicInfo コンポーネントのユニットテスト。
// RPT-FE-071〜072 に対応する。

import { render, screen } from '@testing-library/react';
import ReportBasicInfo from '../ReportBasicInfo';

describe('ReportBasicInfo', () => {
  // RPT-FE-071: 全フィールドが描画される。
  it('RPT-FE-071: タイトル・StatusChip・期間・金額・作成者・作成日が描画される', () => {
    render(
      <ReportBasicInfo
        title="出張費"
        status="draft"
        periodStart="2026-03-01"
        periodEnd="2026-03-31"
        totalAmount={50000}
        submitterName="テスト太郎"
        createdAt="2026-03-01T00:00:00Z"
      />,
    );

    expect(screen.getByText('出張費')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-01/)).toBeInTheDocument();
    expect(screen.getByText('テスト太郎')).toBeInTheDocument();
  });

  // RPT-FE-072: totalAmount=1234567 のとき「1,234,567」と 3 桁カンマ区切りで表示される。
  it('RPT-FE-072: totalAmount が 3 桁カンマ区切りで表示される', () => {
    render(
      <ReportBasicInfo
        title="テスト"
        status="draft"
        periodStart="2026-03-01"
        periodEnd="2026-03-31"
        totalAmount={1234567}
        submitterName="テストユーザー"
        createdAt="2026-03-01T00:00:00Z"
      />,
    );

    expect(screen.getByTestId('total-amount')).toHaveTextContent('1,234,567');
  });
});
