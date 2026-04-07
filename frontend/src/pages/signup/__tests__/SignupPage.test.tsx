// SignupPage のユニットテスト。
// AUTH-FE-025〜029 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import SignupPage from '../SignupPage';
import * as useSignupModule from '../../../hooks/useSignup';
import * as authStore from '../../../stores/auth';
import { ApiClientError } from '../../../api/client';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

describe('SignupPage', () => {
  let mockMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMutateAsync = vi.fn();
    vi.spyOn(useSignupModule, 'useSignup').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSignupModule.useSignup>);

    vi.spyOn(authStore, 'setTokens');
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fillAndSubmitSignupForm = async () => {
    await userEvent.type(screen.getByLabelText('会社名'), 'Test Corp');
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'Test User');
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: '新規登録' }));
  };

  // AUTH-FE-025: サインアップ成功時に setTokens が呼ばれ /dashboard に遷移すること。
  it('AUTH-FE-025: サインアップ成功時に setTokens が呼ばれてダッシュボードに遷移する', async () => {
    const tokens = { access_token: 'access123', refresh_token: 'refresh456' };
    mockMutateAsync.mockResolvedValueOnce(tokens);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await fillAndSubmitSignupForm();

    await waitFor(() => {
      expect(authStore.setTokens).toHaveBeenCalledWith('access123', 'refresh456');
    });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // AUTH-FE-026: 409 EMAIL_ALREADY_EXISTS エラー時にメッセージが設定されること。
  it('AUTH-FE-026: 409 EMAIL_ALREADY_EXISTS エラー時に重複エラーメッセージが表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Email already exists', 409, 'EMAIL_ALREADY_EXISTS'),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await fillAndSubmitSignupForm();

    await waitFor(() => {
      expect(
        screen.getByText('このメールアドレスは既に登録されています'),
      ).toBeInTheDocument();
    });
  });

  // AUTH-FE-027: 429 RATE_LIMIT_EXCEEDED エラー時にレート制限メッセージが表示されること。
  it('AUTH-FE-027: 429 RATE_LIMIT_EXCEEDED エラー時にレート制限メッセージが表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED'),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await fillAndSubmitSignupForm();

    await waitFor(() => {
      expect(screen.getByText('しばらく待ってから再試行してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-028: 500 エラー時にサーバーエラーメッセージが表示されること。
  it('AUTH-FE-028: 500 INTERNAL_ERROR エラー時にサーバーエラーメッセージが表示される', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiClientError('Internal Server Error', 500, 'INTERNAL_ERROR'),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await fillAndSubmitSignupForm();

    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
    });
  });

  // AUTH-FE-029: 認証済みのとき /dashboard にリダイレクトされること。
  it('AUTH-FE-029: 認証済みのとき /dashboard にリダイレクトされる', () => {
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('existing-access-token');

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
