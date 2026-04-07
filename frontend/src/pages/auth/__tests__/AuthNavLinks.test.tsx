// AuthNavLinks コンポーネントのユニットテスト。
// AUTH-FE-006〜007 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthNavLinks from '../AuthNavLinks';

describe('AuthNavLinks', () => {
  // AUTH-FE-006: 複数リンクを正しく描画すること。
  it('AUTH-FE-006: 複数リンクが正しく描画される', () => {
    render(
      <MemoryRouter>
        <AuthNavLinks
          links={[
            { prefix: 'アカウントをお持ちでない方は', label: '新規登録', to: '/signup' },
            { prefix: 'パスワードを忘れた方は', label: 'パスワードリセット', to: '/password-reset' },
          ]}
        />
      </MemoryRouter>,
    );

    // 各リンクの prefix テキストが描画されること。
    expect(screen.getByText('アカウントをお持ちでない方は')).toBeInTheDocument();
    expect(screen.getByText('パスワードを忘れた方は')).toBeInTheDocument();

    // 各リンクテキストと href が正しく描画されること。
    const signupLink = screen.getByRole('link', { name: '新規登録' });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute('href', '/signup');

    const resetLink = screen.getByRole('link', { name: 'パスワードリセット' });
    expect(resetLink).toBeInTheDocument();
    expect(resetLink).toHaveAttribute('href', '/password-reset');
  });

  // AUTH-FE-007: 単一リンクのみが描画されること。
  it('AUTH-FE-007: 単一リンクのみが描画される', () => {
    render(
      <MemoryRouter>
        <AuthNavLinks
          links={[{ prefix: '既にアカウントをお持ちの方は', label: 'ログイン', to: '/login' }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('既にアカウントをお持ちの方は')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: 'ログイン' });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');

    // 他のリンクは存在しないこと。
    expect(screen.queryAllByRole('link')).toHaveLength(1);
  });
});
