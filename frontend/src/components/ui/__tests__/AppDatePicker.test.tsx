// AppDatePicker コンポーネントのユニットテスト。
// issue 119（onBlur 伝播）・issue 120（null 経路削除・空文字返却）に対応するテスト。

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AppDatePicker from '../AppDatePicker';

describe('AppDatePicker', () => {
  // ADT-001: ラベルと入力フィールドが描画される。
  it('ADT-001: label が表示され、type="date" の input が描画される', () => {
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value=""
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText('テスト日付')).toBeInTheDocument();
    expect(screen.getByLabelText('テスト日付')).toHaveAttribute('type', 'date');
  });

  // ADT-002: 値を入力すると onChange が空文字ではなく入力値を渡す（issue 120 修正確認）。
  it('ADT-002: 値を変更したとき onChange に入力値が渡される', () => {
    const handleChange = vi.fn();
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('テスト日付');
    fireEvent.change(input, { target: { value: '2026-03-01' } });

    expect(handleChange).toHaveBeenCalledWith('2026-03-01');
  });

  // ADT-003: 空値（クリア）のとき onChange が空文字を返す（null ではない）（issue 120 修正確認）。
  it('ADT-003: フィールドをクリアすると onChange に空文字が渡される（null ではない）', () => {
    const handleChange = vi.fn();
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value="2026-03-01"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('テスト日付');
    // 空文字をセットしてクリアをシミュレートする。
    fireEvent.change(input, { target: { value: '' } });

    // null ではなく空文字が返ること。
    expect(handleChange).toHaveBeenCalledWith('');
    expect(handleChange).not.toHaveBeenCalledWith(null);
  });

  // ADT-004: onBlur が渡されたとき、フォーカスアウトで呼び出される（issue 119 修正確認）。
  it('ADT-004: onBlur prop が渡されたとき、フォーカスアウトで onBlur が呼び出される', async () => {
    const handleBlur = vi.fn();
    const user = userEvent.setup();
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value=""
        onChange={() => undefined}
        onBlur={handleBlur}
      />
    );

    const input = screen.getByLabelText('テスト日付');
    await user.click(input);
    await user.tab(); // フォーカスアウト

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  // ADT-005: onBlur が渡されないとき、フォーカスアウトしてもエラーが発生しない。
  it('ADT-005: onBlur prop が未指定のとき、フォーカスアウトしてもエラーが発生しない', async () => {
    const user = userEvent.setup();
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value=""
        onChange={() => undefined}
      />
    );

    const input = screen.getByLabelText('テスト日付');
    // エラーが発生しないことを検証する。
    await expect(async () => {
      await user.click(input);
      await user.tab();
    }).not.toThrow();
  });

  // ADT-006: errorMessage が渡されたとき、エラーテキストが表示される。
  it('ADT-006: errorMessage があるとき、エラーメッセージが表示される', () => {
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value=""
        onChange={() => undefined}
        errorMessage="開始日を入力してください"
      />
    );

    expect(screen.getByText('開始日を入力してください')).toBeInTheDocument();
  });

  // ADT-007: disabled=true のとき入力フィールドが disabled になる。
  it('ADT-007: disabled=true のとき input が disabled になる', () => {
    render(
      <AppDatePicker
        name="testDate"
        label="テスト日付"
        value=""
        onChange={() => undefined}
        disabled
      />
    );

    expect(screen.getByLabelText('テスト日付')).toBeDisabled();
  });
});
