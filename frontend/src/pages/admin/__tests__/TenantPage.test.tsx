// TenantPage のユニットテスト。
// TNT-FE-001〜007 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, afterEach } from 'vitest';
import TenantPage from '../TenantPage';
import * as useTenantModule from '../../../hooks/useTenant';
import * as useCurrentUserModule from '../../../hooks/useCurrentUser';
import { ApiClientError } from '../../../api/client';

// AppLayout をモックし、children をそのまま描画する（auth store 依存を排除）。
vi.mock('../../../components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

// テスト用ラッパー: QueryClientProvider + MemoryRouter + Routes。
function renderTenantPage(initialEntries: string[] = ['/settings/tenant']) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/settings/tenant" element={<TenantPage />} />
          <Route path="/" element={<div>Dashboard</div>} />
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
