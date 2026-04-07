// PasswordResetPage のユニットテスト。
// AUTH-FE-057〜063 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import PasswordResetPage from '../PasswordResetPage';
import * as useExecutePasswordResetModule from '../../../hooks/useExecutePasswordReset';
import * as authStore from '../../../stores/auth';
import { ApiClientError } from '../../../api/client';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

describe('PasswordResetPage', () => {
  let mockMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMutateAsync = vi.fn();
    vi.spyOn(useExecutePasswordResetModule, 'useExecutePasswordReset').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useExecutePasswordResetModule.useExecutePasswordReset>);

    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPasswordResetPage = (token = 'valid-token') => {
    return render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/password-reset/${token}`]}>
          <Routes>
            <Route path="/password-reset/:token" element={<PasswordResetPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  const fillAndSubmitResetForm = async (password = 'NewPass1!') => {
    await userEvent.type(screen.getByLabelText('新しいパスワード'), password);
    await userEvent.type(screen.getByLabelText('パスワード（確認）'), password);
    await userEvent.click(screen.getByRole('button', { name: 'パスワードを変更する' }));
  };

  // AUTH-FE-057: 成功後に PasswordResetComplete が表示されること。
  it('AUTH-FE-057: 成功後に PasswordResetComplete が表示される', async () => {
    mockMutateAsync.mockResolvedValueOnce({ message: 'パスワードを変更しました' });
    renderPasswordResetPage();

    await fillAndSubmitResetForm();

    await waitFor(() => {
      expect(screen.getByTestId('password-reset-complete')).toBeInTheDocument();
    });
  });

  // AUTH-FE-058: INVALID_TOKEN エラー時に PasswordResetTokenInvalid が表示されること。
  it('AUTH-FE-058: INVALID_TOKEN エラー時に PasswordResetTokenInvalid が表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Invalid token', 422, 'INVALID_TOKEN'),
    );
    renderPasswordResetPage();

    await fillAndSubmitResetForm();

    await waitFor(() => {
      expect(screen.getByTestId('password-reset-token-invalid')).toBeInTheDocument();
    });
  });

  // AUTH-FE-059: 500 エラー時にサーバーエラーメッセージが表示され、フォームが維持されること。
  it('AUTH-FE-059: 500 エラー時にサーバーエラーメッセージが表示されてフォームが維持される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Internal Server Error', 500, 'INTERNAL_ERROR'),
    );
    renderPasswordResetPage();

    await fillAndSubmitResetForm();

    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
    });

    // フォームが維持されること。
    expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
  });

  // AUTH-FE-060: 429 エラー時にレート制限メッセージが表示されること。
  it('AUTH-FE-060: 429 エラー時にレート制限メッセージが表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED'),
    );
    renderPasswordResetPage();

    await fillAndSubmitResetForm();

    await waitFor(() => {
      expect(screen.getByText('しばらく待ってから再試行してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-061: 認証済みのとき /dashboard にリダイレクトされること。
  it('AUTH-FE-061: 認証済みのとき /dashboard にリダイレクトされる', () => {
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('existing-token');

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/password-reset/sometoken']}>
          <Routes>
            <Route path="/password-reset/:token" element={<PasswordResetPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  // AUTH-FE-062: URL パラメータからトークンが取得されること。
  it('AUTH-FE-062: URL パラメータからトークンが取得されて mutateAsync の引数に含まれる', async () => {
    mockMutateAsync.mockResolvedValueOnce({ message: 'パスワードを変更しました' });
    renderPasswordResetPage('abc123token');

    await fillAndSubmitResetForm();

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'abc123token' }),
      );
    });
  });

  // AUTH-FE-063: 初期表示でフォームと AuthNavLinks が表示され、完了・エラー画面が非表示であること。
  it('AUTH-FE-063: 初期表示でフォームが表示され完了・エラー画面が非表示である', () => {
    renderPasswordResetPage();

    expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード（確認）')).toBeInTheDocument();
    expect(screen.queryByTestId('password-reset-complete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('password-reset-token-invalid')).not.toBeInTheDocument();
  });
});
