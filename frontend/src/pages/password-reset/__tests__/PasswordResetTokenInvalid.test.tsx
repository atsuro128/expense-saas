// PasswordResetTokenInvalid のユニットテスト。
// AUTH-FE-072 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PasswordResetTokenInvalid from '../PasswordResetTokenInvalid';

describe('PasswordResetTokenInvalid', () => {
  // AUTH-FE-072: トークン無効・期限切れメッセージと「パスワードリセット画面へ」リンクが表示されること。
  it('AUTH-FE-072: トークン無効メッセージとパスワードリセット画面へのリンクが表示される', () => {
    render(
      <MemoryRouter>
        <PasswordResetTokenInvalid />
      </MemoryRouter>,
    );

    // トークン無効・期限切れメッセージが表示されること。
    expect(screen.getByText(/無効.*期限切れ/)).toBeInTheDocument();

    // 「パスワードリセット画面へ」リンクが表示されること。
    const resetLink = screen.getByRole('link', { name: 'パスワードリセット画面へ' });
    expect(resetLink).toBeInTheDocument();
    expect(resetLink).toHaveAttribute('href', '/password-reset');
  });
});
