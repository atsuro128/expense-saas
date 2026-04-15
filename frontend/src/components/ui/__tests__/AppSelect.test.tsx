// AppSelect コンポーネントのユニットテスト。
// readOnly prop の開閉制御を中心に検証する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppSelect from '../AppSelect';

const defaultOptions = [
  { value: 'a', label: 'オプションA' },
  { value: 'b', label: 'オプションB' },
];

describe('AppSelect', () => {
  // AppSelect readOnly=true のとき、クリックしても listbox が開かないことを検証する。
  // MUI Select の開閉制御はトップレベル readOnly prop で行われる（SelectInput.js L134/L296/L456）。
  // inputProps.readOnly だけでは hidden input への属性付与のみで開閉制御には効かない。
  it('AppSelect readOnly=true のとき、クリックしても listbox が開かない', async () => {
    const user = userEvent.setup();
    render(
      <AppSelect
        name="test-select"
        label="テスト"
        value="a"
        onChange={() => undefined}
        options={defaultOptions}
        readOnly={true}
      />,
    );

    // combobox（Select のトリガー要素）をクリックする。
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    // readOnly 時は MUI Select の onMouseDown が null になり、listbox が開かない。
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // AppSelect readOnly=false のとき、クリックで listbox が開くことを検証する。
  it('AppSelect readOnly=false のとき、クリックで listbox が開く', async () => {
    const user = userEvent.setup();
    render(
      <AppSelect
        name="test-select"
        label="テスト"
        value="a"
        onChange={() => undefined}
        options={defaultOptions}
        readOnly={false}
      />,
    );

    // combobox をクリックすると listbox が開く。
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  // AppSelect readOnly 未指定（デフォルト false）のとき、クリックで listbox が開くことを検証する。
  it('AppSelect readOnly 未指定のとき、クリックで listbox が開く（デフォルト動作）', async () => {
    const user = userEvent.setup();
    render(
      <AppSelect
        name="test-select"
        label="テスト"
        value="a"
        onChange={() => undefined}
        options={defaultOptions}
      />,
    );

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
