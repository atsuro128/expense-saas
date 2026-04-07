// PasswordResetForm のユニットテスト。
// AUTH-FE-064〜070 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PasswordResetForm from '../PasswordResetForm';

describe('PasswordResetForm', () => {
  // AUTH-FE-064: 新しいパスワードと確認用パスワードのフィールド、送信ボタンが描画されること。
  it('AUTH-FE-064: パスワードフィールドと送信ボタンが描画される', () => {
    render(
      <MemoryRouter>
        <PasswordResetForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'パスワードを変更する' })).toBeInTheDocument();
  });

  // AUTH-FE-065: 有効な入力で onSubmit が { new_password } で呼ばれること（confirm_password は除外）。
  it('AUTH-FE-065: 有効な入力で onSubmit が new_password のみで呼ばれる', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <PasswordResetForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('新しいパスワード'), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('パスワード（確認）'), 'NewPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更する' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({ new_password: 'NewPass1!' });
      // confirm_password は onSubmit の引数に含まれないこと。
      expect(mockOnSubmit).not.toHaveBeenCalledWith(
        expect.objectContaining({ confirm_password: expect.anything() }),
      );
    });
  });

  // AUTH-FE-066: new_password が空のとき必須エラーが表示されること（実装後に動作）。
  it('AUTH-FE-066: new_password が空のとき必須エラーが表示される（実装後に動作）', async () => {
    render(
      <MemoryRouter>
        <PasswordResetForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更する' }));

    // 実装後: パスワード必須エラーが表示されること。
    await waitFor(() => {
      expect(screen.queryByText(/パスワード.*必須/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-067: new_password が 7 文字のとき最小長エラーが表示されること（実装後に動作）。
  it('AUTH-FE-067: new_password が 7 文字のとき最小長エラーが表示される（実装後に動作）', async () => {
    render(
      <MemoryRouter>
        <PasswordResetForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('新しいパスワード'), 'Short1!');
    await userEvent.type(screen.getByLabelText('パスワード（確認）'), 'Short1!');
    await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更する' }));

    // 実装後: パスワード最小長エラーが表示されること。
    await waitFor(() => {
      expect(screen.queryByText(/8文字/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-068: パスワード不一致のとき確認用パスワードにエラーが表示されること（実装後に動作）。
  it('AUTH-FE-068: パスワード不一致のとき確認用フィールドにエラーが表示される（実装後に動作）', async () => {
    render(
      <MemoryRouter>
        <PasswordResetForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('新しいパスワード'), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('パスワード（確認）'), 'DiffPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更する' }));

    // 実装後: パスワード不一致エラーが表示されること。
    await waitFor(() => {
      expect(screen.queryByText(/パスワードが一致/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-069: apiError を指定すると FormAlert にメッセージが表示されること。
  it('AUTH-FE-069: apiError を指定すると FormAlert にエラーメッセージが表示される', () => {
    render(
      <MemoryRouter>
        <PasswordResetForm
          onSubmit={() => {}}
          apiError="サーバーエラーが発生しました"
          isPending={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
  });

  // AUTH-FE-070: isPending=true のとき全フィールドとボタンが disabled になること。
  it('AUTH-FE-070: isPending=true のとき全フィールドとボタンが disabled になる', () => {
    render(
      <MemoryRouter>
        <PasswordResetForm onSubmit={() => {}} apiError={null} isPending={true} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('新しいパスワード')).toBeDisabled();
    expect(screen.getByLabelText('パスワード（確認）')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'パスワードを変更する' })).toBeDisabled();
  });
});
