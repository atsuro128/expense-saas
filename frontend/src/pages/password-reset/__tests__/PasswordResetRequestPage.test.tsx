// PasswordResetRequestPage のユニットテスト。
// AUTH-FE-043〜047 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import PasswordResetRequestPage from '../PasswordResetRequestPage';
import * as useRequestPasswordResetModule from '../../../hooks/useRequestPasswordReset';
import * as authStore from '../../../stores/auth';
import { ApiClientError } from '../../../api/client';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

describe('PasswordResetRequestPage', () => {
  let mockMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMutateAsync = vi.fn();
    vi.spyOn(useRequestPasswordResetModule, 'useRequestPasswordReset').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRequestPasswordResetModule.useRequestPasswordReset>);

    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AUTH-FE-043: 送信成功後に PasswordResetRequestComplete が表示されること。
  it('AUTH-FE-043: 送信成功後に PasswordResetRequestComplete が表示される', async () => {
    mockMutateAsync.mockResolvedValueOnce({ message: 'メールを送信しました' });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <PasswordResetRequestPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // 初期状態ではフォームが表示されていること。
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    // 送信成功後に完了画面が表示されること。
    await waitFor(() => {
      expect(screen.getByTestId('password-reset-request-complete')).toBeInTheDocument();
    });

    // フォームが非表示になること。
    expect(screen.queryByLabelText('メールアドレス')).not.toBeInTheDocument();
  });

  // AUTH-FE-044: 500 エラー時にサーバーエラーメッセージが表示されること。
  it('AUTH-FE-044: 500 エラー時にサーバーエラーメッセージが表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Internal Server Error', 500, 'INTERNAL_ERROR'),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <PasswordResetRequestPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
    });

    // フォームが表示されたままであること。
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
  });

  // AUTH-FE-045: 429 エラー時にレート制限メッセージが表示されること。
  it('AUTH-FE-045: 429 エラー時にレート制限メッセージが表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED'),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <PasswordResetRequestPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(screen.getByText('しばらく待ってから再試行してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-046: 認証済みのとき /dashboard にリダイレクトされること。
  it('AUTH-FE-046: 認証済みのとき /dashboard にリダイレクトされる', () => {
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('existing-token');

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/password-reset']}>
          <Routes>
            <Route path="/password-reset" element={<PasswordResetRequestPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  // AUTH-FE-047: 初期表示でフォームが表示され、完了画面が非表示であること。
  it('AUTH-FE-047: 初期表示でフォームが表示され完了画面が非表示である', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <PasswordResetRequestPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    expect(screen.queryByTestId('password-reset-request-complete')).not.toBeInTheDocument();
  });
});
