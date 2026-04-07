// LoginPage のユニットテスト。
// AUTH-FE-008〜013 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, type Mock } from 'vitest';
import LoginPage from '../LoginPage';
import * as useLoginModule from '../../../hooks/useLogin';
import * as authStore from '../../../stores/auth';

// テスト用 QueryClient（retry=0）。
function createQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

// useLogin のモック型。
interface MockUseLoginReturn {
  mutateAsync: Mock;
  isPending: boolean;
}

describe('LoginPage', () => {
  let mockMutateAsync: Mock;

  beforeEach(() => {
    // useLogin Hook をモックする。
    mockMutateAsync = vi.fn();
    vi.spyOn(useLoginModule, 'useLogin').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useLoginModule.useLogin>);

    // AuthStore の setTokens をスパイする。
    vi.spyOn(authStore, 'setTokens');
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AUTH-FE-008: ログイン成功時に setTokens が呼ばれ /dashboard に遷移すること。
  it('AUTH-FE-008: ログイン成功時に setTokens が呼ばれてダッシュボードに遷移する', async () => {
    const tokens = { access_token: 'access123', refresh_token: 'refresh456' };
    mockMutateAsync.mockResolvedValueOnce(tokens);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // フォームを入力して送信する。
    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      // setTokens が呼ばれること。
      expect(authStore.setTokens).toHaveBeenCalledWith('access123', 'refresh456');
    });

    // ダッシュボードに遷移すること。
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // AUTH-FE-009: リダイレクト元がある場合はそのパスに遷移すること。
  it('AUTH-FE-009: location.state.from がある場合はリダイレクト元に遷移する', async () => {
    const tokens = { access_token: 'access123', refresh_token: 'refresh456' };
    mockMutateAsync.mockResolvedValueOnce(tokens);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: '/reports' } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reports" element={<div>Reports</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });
  });

  // AUTH-FE-010: 401 エラー時に統一メッセージが表示されること（SEC-011）。
  it('AUTH-FE-010: 401 INVALID_CREDENTIALS エラー時に統一メッセージが表示される', async () => {
    const error = new Error('Unauthorized');
    Object.assign(error, { status: 401, code: 'INVALID_CREDENTIALS' });
    mockMutateAsync.mockRejectedValueOnce(error);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'WrongPass!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      // SEC-011 準拠の統一メッセージが表示されること。
      expect(
        screen.getByText('メールアドレスまたはパスワードが正しくありません'),
      ).toBeInTheDocument();
    });
  });

  // AUTH-FE-011: 429 エラー時にレート制限メッセージが表示されること。
  it('AUTH-FE-011: 429 RATE_LIMIT_EXCEEDED エラー時にレート制限メッセージが表示される', async () => {
    const error = new Error('Too Many Requests');
    Object.assign(error, { status: 429, code: 'RATE_LIMIT_EXCEEDED' });
    mockMutateAsync.mockRejectedValueOnce(error);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(screen.getByText('しばらく待ってから再試行してください')).toBeInTheDocument();
    });
  });

  // AUTH-FE-012: 500 エラー時にサーバーエラーメッセージが表示されること。
  it('AUTH-FE-012: 500 INTERNAL_ERROR エラー時にサーバーエラーメッセージが表示される', async () => {
    const error = new Error('Internal Server Error');
    Object.assign(error, { status: 500, code: 'INTERNAL_ERROR' });
    mockMutateAsync.mockRejectedValueOnce(error);

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('パスワード'), 'TestPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      // サーバーエラーメッセージが表示されること。
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // AUTH-FE-013: 認証済みのとき /dashboard にリダイレクトされること。
  it('AUTH-FE-013: 認証済みのとき /dashboard にリダイレクトされる', () => {
    // isAuthenticated=true を返すようにモックする。
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue('existing-access-token');

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // AuthLayout が /dashboard にリダイレクトすること。
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
