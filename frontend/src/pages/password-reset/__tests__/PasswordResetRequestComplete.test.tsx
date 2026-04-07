// PasswordResetRequestComplete のユニットテスト。
// AUTH-FE-054 に対応する。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PasswordResetRequestComplete from '../PasswordResetRequestComplete';

describe('PasswordResetRequestComplete', () => {
  // AUTH-FE-054: 送信完了メッセージと迷惑メールフォルダの注意書きが表示されること。
  it('AUTH-FE-054: 送信完了メッセージと迷惑メールフォルダの注意書きが表示される', () => {
    render(
      <MemoryRouter>
        <PasswordResetRequestComplete />
      </MemoryRouter>,
    );

    // 送信完了メッセージが表示されること。
    expect(screen.getByText(/パスワードリセット用のメール/)).toBeInTheDocument();
    // 迷惑メールフォルダの注意書きが表示されること。
    expect(screen.getByText(/迷惑メールフォルダ/)).toBeInTheDocument();
  });
});
