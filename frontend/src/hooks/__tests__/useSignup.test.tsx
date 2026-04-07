// useSignup Hook のユニットテスト。
// AUTH-FE-040〜042 に対応する。

import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useSignup } from '../useSignup';
import * as authStore from '../../stores/auth';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSignup', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(authStore, 'setTokens');
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.spyOn(authStore, 'getRefreshToken').mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // AUTH-FE-040: API 呼び出しが成功し AuthTokens が返ること。
  it('AUTH-FE-040: mutateAsync が AuthTokens を返す', async () => {
    const mockTokens = {
      user: { id: 'user1', name: 'Test Admin', email: 'new@example.com', role: 'admin' as const },
      tenant: { id: 'tenant1', name: 'New Corp' },
      access_token: 'access123',
      refresh_token: 'refresh456',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: mockTokens }),
    } as unknown as Response);

    const { result } = renderHook(() => useSignup(), { wrapper: createWrapper() });

    let tokens;
    await act(async () => {
      tokens = await result.current.mutateAsync({
        company_name: 'New Corp',
        user_name: 'Test Admin',
        email: 'new@example.com',
        password: 'TestPass1!',
      });
    });

    expect(tokens).toEqual(mockTokens);
  });

  // AUTH-FE-041: 409 EMAIL_ALREADY_EXISTS エラー時に ApiClientError が投げられること。
  it('AUTH-FE-041: 409 EMAIL_ALREADY_EXISTS エラー時に ApiClientError が投げられる', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useSignup(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          company_name: 'New Corp',
          user_name: 'Test Admin',
          email: 'existing@example.com',
          password: 'TestPass1!',
        }),
      ).rejects.toThrow();
    });
  });

  // AUTH-FE-042: サインアップ成功時に AuthStore.setTokens が呼ばれること。
  it('AUTH-FE-042: サインアップ成功時に AuthStore.setTokens が呼ばれる', async () => {
    const mockTokens = {
      user: { id: 'user1', name: 'Test Admin', email: 'new@example.com', role: 'admin' as const },
      tenant: { id: 'tenant1', name: 'New Corp' },
      access_token: 'access123',
      refresh_token: 'refresh456',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: mockTokens }),
    } as unknown as Response);

    const { result } = renderHook(() => useSignup(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        company_name: 'New Corp',
        user_name: 'Test Admin',
        email: 'new@example.com',
        password: 'TestPass1!',
      });
    });

    // onSuccess で setTokens が呼ばれること。
    expect(authStore.setTokens).toHaveBeenCalledWith('access123', 'refresh456');
  });
});
