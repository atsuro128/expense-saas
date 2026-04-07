// SubmitButton コンポーネントのユニットテスト。
// AUTH-FE-004〜005 に対応する。

import { render, screen } from '@testing-library/react';
import SubmitButton from '../SubmitButton';

describe('SubmitButton', () => {
  // AUTH-FE-004: label を表示し、loading=false のとき disabled でないこと。
  it('AUTH-FE-004: label が表示され、loading=false のとき disabled でない', () => {
    render(<SubmitButton label="ログイン" loading={false} />);
    const button = screen.getByRole('button', { name: 'ログイン' });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  // AUTH-FE-005: loading=true のとき disabled でありスピナーが表示されること。
  it('AUTH-FE-005: loading=true のとき disabled でありスピナーが表示される', () => {
    render(<SubmitButton label="ログイン" loading={true} />);
    const button = screen.getByRole('button', { name: 'ログイン' });
    expect(button).toBeDisabled();
    // スピナーが表示されること（data-testid="spinner" で確認）。
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
