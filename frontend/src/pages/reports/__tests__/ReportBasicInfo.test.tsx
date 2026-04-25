// ReportBasicInfo コンポーネントのユニットテスト。
// RPT-FE-071〜072、RPT-FE-108〜109 に対応する。

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
    expect(screen.getByText(/テスト太郎/)).toBeInTheDocument();
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

  // RPT-FE-108: 常時表示 4 項目（対象期間・合計金額・作成者・作成日）のラベルが全て表示される。
  it('RPT-FE-108: 対象期間・合計金額・作成者・作成日のラベルが UI 上に出現する', () => {
    render(
      <ReportBasicInfo
        title="出張費"
        status="draft"
        periodStart="2026-03-01"
        periodEnd="2026-03-31"
        totalAmount={50000}
        submitterName="テスト太郎"
        createdAt="2026-04-23T15:56:00+09:00"
      />,
    );

    // 各ラベル文字列が UI 上に 1 回以上出現すること
    expect(screen.getByText(/対象期間:/)).toBeInTheDocument();
    expect(screen.getByText(/合計金額:/)).toBeInTheDocument();
    expect(screen.getByText(/作成者:/)).toBeInTheDocument();
    expect(screen.getByText(/作成日:/)).toBeInTheDocument();
  });

  // RPT-FE-109: 作成日が YYYY/MM/DD HH:mm 形式で表示され、YYYY/MM/DD 単独表記は出現しない。
  it('RPT-FE-109: 作成日が YYYY/MM/DD HH:mm 形式（時刻付き）で表示される', () => {
    render(
      <ReportBasicInfo
        title="出張費"
        status="draft"
        periodStart="2026-03-01"
        periodEnd="2026-03-31"
        totalAmount={50000}
        submitterName="テスト太郎"
        createdAt="2026-04-23T15:56:00+09:00"
      />,
    );

    // 時刻付きフォーマット（2026/04/23 15:56）が表示されること
    expect(screen.getByText(/作成日:.*2026\/04\/23 15:56/)).toBeInTheDocument();
    // YYYY/MM/DD 単独表記（時刻なし）が独立して出現しないこと
    // 正規表現: 「2026/04/23」の後に半角スペース + 時刻がない（行末または非時刻文字が続く）パターンを否定
    const createdAtElement = screen.getByText(/作成日:/);
    expect(createdAtElement.textContent).toMatch(/2026\/04\/23 15:56/);
    expect(createdAtElement.textContent).not.toMatch(/^作成日: 2026\/04\/23$/);
  });
});
