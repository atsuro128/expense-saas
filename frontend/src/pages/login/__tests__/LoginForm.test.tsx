// LoginForm のユニットテスト。
// AUTH-FE-014〜020 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LoginForm from '../LoginForm';

describe('LoginForm', () => {
  // AUTH-FE-014: メールアドレスとパスワードの入力フィールド、ログインボタンが描画されること。
  it('AUTH-FE-014: メールアドレス・パスワードフィールドとログインボタンが描画される', () => {
    render(
      <MemoryRouter>
        <LoginForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  // AUTH-FE-015: 有効な入力で onSubmit が呼ばれること。
  it('AUTH-FE-015: 有効な入力で onSubmit が正しい値で呼ばれる', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'TestPass1!',
      });
    });
  });

  // AUTH-FE-016: email が空のとき必須エラーが表示され onSubmit が呼ばれないこと。
  it('AUTH-FE-016: email が空のとき必須エラーが表示される', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // email フィールドにフォーカスしてすぐ離す（onBlur によるバリデーション発火）。
    await userEvent.click(screen.getByLabelText('メールアドレス'));
    await userEvent.tab();

    await waitFor(() => {
      // 画面仕様 V1: 「メールアドレスを入力してください」
      expect(screen.queryByText('メールアドレスを入力してください')).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  // AUTH-FE-017: email 形式不正のとき形式エラーが表示され onSubmit が呼ばれないこと。
  it('AUTH-FE-017: email 形式不正のとき形式エラーが表示される', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // 不正な形式を入力してフォーカスアウト（onBlur によるバリデーション発火）。
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'not-an-email');
    await userEvent.tab();

    // 画面仕様 V2: 「有効なメールアドレスを入力してください」
    await waitFor(() => {
      expect(screen.queryByText('有効なメールアドレスを入力してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-018: password が空のとき必須エラーが表示されること。
  it('AUTH-FE-018: password が空のとき必須エラーが表示される', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // password フィールドにフォーカスしてすぐ離す（onBlur によるバリデーション発火）。
    await userEvent.click(screen.getByLabelText('パスワード'));
    await userEvent.tab();

    // 画面仕様 V3: 「パスワードを入力してください」
    await waitFor(() => {
      expect(screen.queryByText('パスワードを入力してください')).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  // AUTH-FE-019: apiError を指定すると FormAlert にメッセージが表示されること。
  it('AUTH-FE-019: apiError を指定すると FormAlert にエラーメッセージが表示される', () => {
    render(
      <MemoryRouter>
        <LoginForm
          onSubmit={() => {}}
          apiError="メールアドレスまたはパスワードが正しくありません"
          isPending={false}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('メールアドレスまたはパスワードが正しくありません'),
    ).toBeInTheDocument();
  });

  // AUTH-FE-020: isPending=true のとき全フィールドとボタンが disabled になること。
  it('AUTH-FE-020: isPending=true のとき全フィールドとボタンが disabled になる', () => {
    render(
      <MemoryRouter>
        <LoginForm onSubmit={() => {}} apiError={null} isPending={true} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('メールアドレス')).toBeDisabled();
    expect(screen.getByLabelText('パスワード')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeDisabled();
  });
});
