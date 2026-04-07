// PasswordResetComplete のユニットテスト。
// AUTH-FE-071 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PasswordResetComplete from '../PasswordResetComplete';

describe('PasswordResetComplete', () => {
  // AUTH-FE-071: パスワード変更完了メッセージと「ログイン画面へ」リンクが表示されること。
  it('AUTH-FE-071: パスワード変更完了メッセージとログイン画面へのリンクが表示される', () => {
    render(
      <MemoryRouter>
        <PasswordResetComplete />
      </MemoryRouter>,
    );

    // パスワード変更完了メッセージが表示されること。
    expect(screen.getByText(/パスワードが変更/)).toBeInTheDocument();

    // 「ログイン画面へ」ボタン（リンク）が表示されること。
    const loginLink = screen.getByRole('link', { name: 'ログイン画面へ' });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });
});
