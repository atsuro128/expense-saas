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
  // 注意: スタブ実装では react-hook-form + zod がないため、このテストは実装後に動作する。
  it('AUTH-FE-016: email が空のとき必須エラーが表示される（実装後に動作）', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // email を空のまま送信する。
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    // スタブでは onSubmit が呼ばれてしまうが、実装後はフロントエンドバリデーションで防ぐ。
    // 実装後のテスト: expect(mockOnSubmit).not.toHaveBeenCalled()
    // 実装後: email エラーメッセージが表示されること。
    // 現時点では失敗するテストとして残す。
    await waitFor(() => {
      // バリデーションエラーが表示されていること（実装後に通過する）。
      expect(screen.queryByText(/メールアドレス.*必須/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-017: email 形式不正のとき形式エラーが表示され onSubmit が呼ばれないこと。
  it('AUTH-FE-017: email 形式不正のとき形式エラーが表示される（実装後に動作）', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    // 実装後: 形式エラーが表示されること。
    await waitFor(() => {
      expect(screen.queryByText(/メール.*形式/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-018: password が空のとき必須エラーが表示されること。
  it('AUTH-FE-018: password が空のとき必須エラーが表示される（実装後に動作）', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <LoginForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    // 実装後: パスワード必須エラーが表示されること。
    await waitFor(() => {
      expect(screen.queryByText(/パスワード.*必須/)).toBeInTheDocument();
    });
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
