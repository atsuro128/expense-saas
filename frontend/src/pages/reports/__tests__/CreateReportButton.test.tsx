// CreateReportButton コンポーネントのユニットテスト。
// RPT-FE-010 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CreateReportButton from '../CreateReportButton';

describe('CreateReportButton', () => {
  // RPT-FE-010: ボタンが描画され、クリックすると onClick コールバックが呼ばれる。
  it('RPT-FE-010: ボタンが描画され onClick コールバックが呼ばれる', async () => {
    const onClick = vi.fn();
    render(<CreateReportButton onClick={onClick} />);

    const button = screen.getByRole('button', { name: /\+ レポート作成/ });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
