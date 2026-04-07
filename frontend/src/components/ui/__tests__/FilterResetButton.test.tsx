// FilterResetButton コンポーネントのユニットテスト。
// WFL-FE-024〜026（承認待ち一覧コンテキスト）
// WFL-FE-081〜082（支払待ち一覧コンテキスト）に対応する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import FilterResetButton from '../FilterResetButton';

describe('FilterResetButton', () => {
  // WFL-FE-024: isFiltered=true のときボタンが有効状態（disabled でない）で描画される。
  it('WFL-FE-024: enabled_when_filter_applied — isFiltered=true のときボタンが有効', () => {
    const onReset = vi.fn();
    render(<FilterResetButton isFiltered={true} onReset={onReset} />);
    // ボタンが disabled でないこと。
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  // WFL-FE-025: isFiltered=false のときボタンが disabled で描画される。
  it('WFL-FE-025: disabled_when_no_filter — isFiltered=false のときボタンが disabled', () => {
    const onReset = vi.fn();
    render(<FilterResetButton isFiltered={false} onReset={onReset} />);
    // ボタンが disabled であること。
    expect(screen.getByRole('button')).toBeDisabled();
  });

  // WFL-FE-026: isFiltered=true でボタンをクリックすると onReset コールバックが呼び出される。
  it('WFL-FE-026: calls_on_reset_on_click — ボタンクリックで onReset が呼び出される', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<FilterResetButton isFiltered={true} onReset={onReset} />);

    await user.click(screen.getByRole('button'));

    // onReset コールバックが1回呼び出されること。
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // WFL-FE-081: 支払待ち一覧コンテキスト — isFiltered=true のときリセットボタンが有効化される。
  it('WFL-FE-081: payable_enabled_when_filtered — isFiltered=true のときボタンが有効', () => {
    const onReset = vi.fn();
    render(<FilterResetButton isFiltered={true} onReset={onReset} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  // WFL-FE-082: 支払待ち一覧コンテキスト — リセットボタンをクリックすると onReset が呼び出される。
  it('WFL-FE-082: payable_calls_on_reset — リセットボタンをクリックで onReset が呼び出される', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<FilterResetButton isFiltered={true} onReset={onReset} />);

    await user.click(screen.getByRole('button'));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
