// ReportListFilter コンポーネントのユニットテスト。
// RPT-FE-011〜014 に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReportListFilter from '../ReportListFilter';

const defaultValues = { status: '' as const, from: '', to: '' };

describe('ReportListFilter', () => {
  // RPT-FE-011: ステータスフィルタ（AppSelect）と日付ピッカー（×2）が描画される。
  it('RPT-FE-011: ステータスフィルタと日付ピッカーが描画される', () => {
    render(<ReportListFilter values={defaultValues} onFilterChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: /ステータス/ })).toBeInTheDocument();
    expect(screen.getByLabelText('開始日フィルター')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日フィルター')).toBeInTheDocument();
  });

  // RPT-FE-012: ステータスフィルタで「下書き」を選択すると onFilterChange が呼ばれる。
  it('RPT-FE-012: ステータスフィルタで「下書き」を選択すると onFilterChange が呼ばれる', async () => {
    const onFilterChange = vi.fn();
    render(<ReportListFilter values={defaultValues} onFilterChange={onFilterChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ステータス/ }), 'draft');

    expect(onFilterChange).toHaveBeenCalledWith({ status: 'draft', from: '', to: '' });
  });

  // RPT-FE-013: 開始日を入力すると onFilterChange が from を含む値で呼ばれる。
  it('RPT-FE-013: 開始日を入力すると onFilterChange が from を含む値で呼ばれる', async () => {
    const onFilterChange = vi.fn();
    render(<ReportListFilter values={defaultValues} onFilterChange={onFilterChange} />);

    const startInput = screen.getByLabelText('開始日フィルター');
    await userEvent.type(startInput, '2026-03-01');

    expect(onFilterChange).toHaveBeenCalled();
    const calls = onFilterChange.mock.calls;
    const lastCall = calls[calls.length - 1]![0];
    expect(lastCall.from).toBeTruthy();
  });

  // RPT-FE-014: ステータスフィルタのドロップダウンに「全て」「下書き」等の選択肢が表示される。
  it('RPT-FE-014: ステータスフィルタに全選択肢が表示される', () => {
    render(<ReportListFilter values={defaultValues} onFilterChange={vi.fn()} />);

    const select = screen.getByRole('combobox', { name: /ステータス/ });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

    expect(options).toContain('全て');
    expect(options).toContain('下書き');
    expect(options).toContain('提出済み');
    expect(options).toContain('承認済み');
    expect(options).toContain('却下');
    expect(options).toContain('支払済み');
  });
});
