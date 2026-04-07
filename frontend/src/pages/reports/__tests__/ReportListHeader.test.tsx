// ReportListHeader コンポーネントのユニットテスト。
// RPT-FE-008〜009 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReportListHeader from '../ReportListHeader';

describe('ReportListHeader', () => {
  // RPT-FE-008: 「マイレポート」タイトルと「+ レポート作成」ボタンが描画される。
  it('RPT-FE-008: 「マイレポート」タイトルと「+ レポート作成」ボタンが描画される', () => {
    const onCreateReport = vi.fn();
    render(<ReportListHeader onCreateReport={onCreateReport} />);

    expect(screen.getByText('マイレポート')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ レポート作成/ })).toBeInTheDocument();
  });

  // RPT-FE-009: 「+ レポート作成」ボタンをクリックすると onCreateReport コールバックが呼ばれる。
  it('RPT-FE-009: 「+ レポート作成」ボタンをクリックすると onCreateReport が呼ばれる', async () => {
    const onCreateReport = vi.fn();
    render(<ReportListHeader onCreateReport={onCreateReport} />);

    await userEvent.click(screen.getByRole('button', { name: /\+ レポート作成/ }));

    expect(onCreateReport).toHaveBeenCalledTimes(1);
  });
});
