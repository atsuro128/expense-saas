// SignupForm のユニットテスト。
// AUTH-FE-030〜039 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SignupForm from '../SignupForm';

describe('SignupForm', () => {
  // AUTH-FE-030: 全フィールドと送信ボタンが描画されること。
  it('AUTH-FE-030: 全入力フィールドと送信ボタンが描画される', () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('会社名')).toBeInTheDocument();
    expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument();
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新規登録' })).toBeInTheDocument();
  });

  // AUTH-FE-031: 有効な入力で onSubmit が正しい値で呼ばれること。
  it('AUTH-FE-031: 有効な入力で onSubmit が正しい SignupInput で呼ばれる', async () => {
    const mockOnSubmit = vi.fn();
    render(
      <MemoryRouter>
        <SignupForm onSubmit={mockOnSubmit} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('会社名'), 'Test Corp');
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'Test User');
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: '新規登録' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        company_name: 'Test Corp',
        user_name: 'Test User',
        email: 'new@example.com',
        password: 'TestPass1!',
      });
    });
  });

  // AUTH-FE-032: company_name が空のとき必須エラーが表示されること。
  it('AUTH-FE-032: company_name が空のとき必須エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // company_name フィールドにフォーカスしてすぐ離す（onBlur によるバリデーション発火）。
    await userEvent.click(screen.getByLabelText('会社名'));
    await userEvent.tab();

    // 画面仕様 V1: 「会社名を入力してください」
    await waitFor(() => {
      expect(screen.queryByText('会社名を入力してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-033: company_name が 201 文字のとき文字数超過エラーが表示されること。
  it('AUTH-FE-033: company_name が 201 文字のとき文字数超過エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // 201 文字入力してフォーカスアウト（onBlur によるバリデーション発火）。
    await userEvent.type(screen.getByLabelText('会社名'), 'あ'.repeat(201));
    await userEvent.tab();

    // 画面仕様 V2: 「会社名は200文字以内で入力してください」
    await waitFor(() => {
      expect(screen.queryByText(/200文字/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-034: user_name が空のとき必須エラーが表示されること。
  it('AUTH-FE-034: user_name が空のとき必須エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // user_name フィールドにフォーカスしてすぐ離す（onBlur によるバリデーション発火）。
    await userEvent.click(screen.getByLabelText('ユーザー名'));
    await userEvent.tab();

    // 画面仕様 V3: 「ユーザー名を入力してください」
    await waitFor(() => {
      expect(screen.queryByText('ユーザー名を入力してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-035: email 形式不正のとき形式エラーが表示されること。
  it('AUTH-FE-035: email 形式不正のとき形式エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // 不正な形式を入力してフォーカスアウト（onBlur によるバリデーション発火）。
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'not-an-email');
    await userEvent.tab();

    // 画面仕様 V6: 「有効なメールアドレスを入力してください」
    await waitFor(() => {
      expect(screen.queryByText('有効なメールアドレスを入力してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-036: password が 7 文字のとき最小長エラーが表示されること。
  it('AUTH-FE-036: password が 7 文字のとき最小長エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // 7 文字入力してフォーカスアウト（onBlur によるバリデーション発火）。
    await userEvent.type(screen.getByLabelText('パスワード'), 'Short1!'); // 7 文字
    await userEvent.tab();

    // 画面仕様 V8: 「パスワードは8文字以上で入力してください」
    await waitFor(() => {
      expect(screen.queryByText(/8文字/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-037: password が 129 文字のとき文字数超過エラーが表示されること。
  it('AUTH-FE-037: password が 129 文字のとき文字数超過エラーが表示される', async () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={false} />
      </MemoryRouter>,
    );

    // 129 文字入力してフォーカスアウト（onBlur によるバリデーション発火）。
    await userEvent.type(screen.getByLabelText('パスワード'), 'a'.repeat(129));
    await userEvent.tab();

    // 「パスワードは128文字以内で入力してください」
    await waitFor(() => {
      expect(screen.queryByText(/128文字/)).toBeInTheDocument();
    });
  });

  // AUTH-FE-038: apiError を指定すると FormAlert にメッセージが表示されること。
  it('AUTH-FE-038: apiError を指定すると FormAlert にエラーメッセージが表示される', () => {
    render(
      <MemoryRouter>
        <SignupForm
          onSubmit={() => {}}
          apiError="このメールアドレスは既に登録されています"
          isPending={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('このメールアドレスは既に登録されています')).toBeInTheDocument();
  });

  // AUTH-FE-039: isPending=true のとき全フィールドとボタンが disabled になること。
  it('AUTH-FE-039: isPending=true のとき全フィールドとボタンが disabled になる', () => {
    render(
      <MemoryRouter>
        <SignupForm onSubmit={() => {}} apiError={null} isPending={true} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('会社名')).toBeDisabled();
    expect(screen.getByLabelText('ユーザー名')).toBeDisabled();
    expect(screen.getByLabelText('メールアドレス')).toBeDisabled();
    expect(screen.getByLabelText('パスワード')).toBeDisabled();
    expect(screen.getByRole('button', { name: '新規登録' })).toBeDisabled();
  });
});
