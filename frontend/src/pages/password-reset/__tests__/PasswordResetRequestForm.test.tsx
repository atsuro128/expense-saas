// PasswordResetRequestForm のユニットテスト。
// AUTH-FE-048〜053 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PasswordResetRequestForm from '../PasswordResetRequestForm';

describe('PasswordResetRequestForm', () => {
  // AUTH-FE-048: メールアドレス入力フィールドと送信ボタンが描画されること。
  it('AUTH-FE-048: メールアドレスフィールドと送信ボタンが描画される', () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument();
  });

  // AUTH-FE-049: 有効な入力で onSubmit が正しい値で呼ばれること。
  it('AUTH-FE-049: 有効な入力で onSubmit が正しい値で呼ばれる', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <PasswordResetRequestForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({ email: 'user@example.com' });
    });
  });

  // AUTH-FE-050: email が空のとき必須エラーが表示されること。
  it('AUTH-FE-050: email が空のとき必須エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // email フィールドにフォーカスしてすぐ離す（onBlur によるバリデーション発火）。
    await userEvent.click(screen.getByLabelText('メールアドレス'));
    await userEvent.tab();

    // 画面仕様 V1: 「メールアドレスを入力してください」
    await waitFor(() => {
      expect(screen.queryByText('メールアドレスを入力してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-051: email 形式不正のとき形式エラーが表示されること。
  it('AUTH-FE-051: email 形式不正のとき形式エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // 不正な形式を入力してフォーカスアウト（onBlur によるバリデーション発火）。
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'not-valid');
    await userEvent.tab();

    // 画面仕様 V2: 「有効なメールアドレスを入力してください」
    await waitFor(() => {
      expect(screen.queryByText('有効なメールアドレスを入力してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-052: apiError を指定すると FormAlert にメッセージが表示されること。
  it('AUTH-FE-052: apiError を指定すると FormAlert にエラーメッセージが表示される', () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestForm
          onSubmit={() => {}}
          apiError="サーバーエラーが発生しました"
          isPending={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
  });

  // AUTH-FE-053: isPending=true のとき全フィールドとボタンが disabled になること。
  it('AUTH-FE-053: isPending=true のとき全フィールドとボタンが disabled になる', () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestForm onSubmit={() => {}} apiError={null} isPending={true} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('メールアドレス')).toBeDisabled();
    expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
  });
});
