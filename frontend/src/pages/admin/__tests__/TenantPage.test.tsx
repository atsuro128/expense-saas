// TenantPage のユニットテスト。
// TNT-FE-001〜007 に対応する。
// TNT-FE-008〜009: issue 088（403 認可エラーフィードバック）の navigate toast state 確認テストを追加。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, afterEach } from 'vitest';
import TenantPage from '../TenantPage';
import * as useTenantModule from '../../../hooks/useTenant';
import * as useCurrentUserModule from '../../../hooks/useCurrentUser';
import { ApiClientError } from '../../../api/client';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/** navigate で渡された state を検証するためのヘルパーコンポーネント。 */
function DashboardWithState() {
  const location = useLocation();
  const state = location.state as { toast?: { severity: string; message: string } } | null;
  return (
    <div>
      <div>Dashboard</div>
      {state?.toast && (
        <div data-testid="nav-toast-message">{state.toast.message}</div>
      )}
    </div>
  );
}

// テスト用ラッパー: QueryClientProvider + MemoryRouter + Routes。
// 実アプリの / → /dashboard 2段遷移を再現するためルート構成を合わせる。
function renderTenantPage(initialEntries: string[] = ['/settings/tenant']) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/settings/tenant" element={<TenantPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardWithState />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TenantPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TNT-FE-001: useTenant が成功データを返す場合、TenantInfoCard が描画されること。
  it('TNT-FE-001: useTenant 成功時にテナント情報が表示される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user1', name: 'Test Admin', email: 'admin@example.com', role: 'admin', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: { data: { id: 'aaaaaaaa-0001-0001-0001-000000000001', name: 'Test Company A', created_at: '2026-01-01T00:00:00Z' } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    // TenantInfoCard が描画され、会社名「Test Company A」が表示されること。
    await waitFor(() => {
      expect(screen.getByText('Test Company A')).toBeInTheDocument();
    });

    // PhaseNotice が表示されること。
    expect(screen.getByText('テナント情報の編集機能は今後追加予定です。')).toBeInTheDocument();
  });

  // TNT-FE-002: Approver ロールの場合はダッシュボードにリダイレクトされること。
  it('TNT-FE-002: Approver ロールはダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user2', name: 'Test Approver', email: 'approver@example.com', role: 'approver', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-003: Member ロールの場合はダッシュボードにリダイレクトされること。
  it('TNT-FE-003: Member ロールはダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user3', name: 'Test Member', email: 'member@example.com', role: 'member', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-004: Accounting ロールの場合はダッシュボードにリダイレクトされること。
  it('TNT-FE-004: Accounting ロールはダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user4', name: 'Test Accounting', email: 'accounting@example.com', role: 'accounting', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-005: 403 エラー時はダッシュボードにリダイレクトされること。
  it('TNT-FE-005: 403 エラー時はダッシュボードにリダイレクトされる', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user1', name: 'Test Admin', email: 'admin@example.com', role: 'admin', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('Forbidden', 403, 'FORBIDDEN'),
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  // TNT-FE-006: 500 エラー時は SnackbarContext にエラーメッセージが通知されること。
  it('TNT-FE-006: 500 エラー時は AppToast にエラーメッセージが通知される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user1', name: 'Test Admin', email: 'admin@example.com', role: 'admin', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('Internal Server Error', 500, 'INTERNAL_ERROR'),
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    // AppToast にエラーメッセージが表示されること。
    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
    });
  });

  // TNT-FE-008: ロール不一致時にリダイレクト先でトーストメッセージが表示されること（issue 088）。
  it('TNT-FE-008: ロール不一致時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user3', name: 'Test Member', email: 'member@example.com', role: 'member', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    // ダッシュボードにリダイレクトされること。
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // navigate の state にトーストメッセージが含まれること。
    await waitFor(() => {
      expect(screen.getByTestId('nav-toast-message')).toHaveTextContent('この画面にアクセスする権限がありません。');
    });
  });

  // TNT-FE-009: 403 エラー時にリダイレクト先でトーストメッセージが表示されること（issue 088）。
  it('TNT-FE-009: 403 エラー時に navigate が state.toast 付きで呼ばれ、リダイレクト先でメッセージが表示される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user1', name: 'Test Admin', email: 'admin@example.com', role: 'admin', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('Forbidden', 403, 'FORBIDDEN'),
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    // ダッシュボードにリダイレクトされること。
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // navigate の state にトーストメッセージが含まれること。
    await waitFor(() => {
      expect(screen.getByTestId('nav-toast-message')).toHaveTextContent('この画面にアクセスする権限がありません。');
    });
  });

  // TNT-FE-007: isLoading = true の場合は PageSkeleton が表示されること。
  it('TNT-FE-007: isLoading 中は PageSkeleton（variant="card"）が表示される', async () => {
    vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
      data: { data: { id: 'user1', name: 'Test Admin', email: 'admin@example.com', role: 'admin', tenant: { id: 'tenant1', name: 'Test Company A' } } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUserModule.useCurrentUser>);

    vi.spyOn(useTenantModule, 'useTenant').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTenantModule.useTenant>);

    renderTenantPage();

    // PageSkeleton（variant="card"）が表示されること。
    await waitFor(() => {
      expect(screen.getByTestId('page-skeleton-card')).toBeInTheDocument();
    });
  });
});
