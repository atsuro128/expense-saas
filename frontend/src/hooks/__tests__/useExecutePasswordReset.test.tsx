// useExecutePasswordReset Hook のユニットテスト。
// AUTH-FE-073〜076 に対応する。

import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';
import { useExecutePasswordReset } from '../useExecutePasswordReset';
import * as authStore from '../../stores/auth';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useExecutePasswordReset', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.spyOn(authStore, 'getAccessToken').mockReturnValue(null);
    vi.spyOn(authStore, 'getRefreshToken').mockReturnValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // AUTH-FE-073: API 呼び出しが成功し message を含むレスポンスが返ること。
  it('AUTH-FE-073: mutateAsync が成功しレスポンスに message が含まれる', async () => {
    const mockResponse = { message: 'パスワードを変更しました' };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockResponse }),
    } as unknown as Response);

    const { result } = renderHook(() => useExecutePasswordReset(), { wrapper: createWrapper() });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        token: 'valid-token',
        new_password: 'NewPass1!',
      });
    });

    expect(response).toEqual(mockResponse);
    expect((response as typeof mockResponse).message).toBeTruthy();
  });

  // AUTH-FE-074: 422 INVALID_TOKEN エラー時に ApiClientError が投げられること。
  it('AUTH-FE-074: 422 INVALID_TOKEN エラー時に ApiClientError が投げられる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INVALID_TOKEN', message: 'Invalid token' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useExecutePasswordReset(), { wrapper: createWrapper() });

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ token: 'invalid-token', new_password: 'NewPass1!' });
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBeDefined();
    // ApiClientError のコードが INVALID_TOKEN であること。
    expect((thrownError as { code: string }).code).toBe('INVALID_TOKEN');
  });

  // AUTH-FE-075: 期限切れトークン（422 INVALID_TOKEN）でも ApiClientError が投げられること。
  it('AUTH-FE-075: 期限切れトークンでも ApiClientError が投げられエラーコードが INVALID_TOKEN である', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'INVALID_TOKEN', message: 'Token has expired' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useExecutePasswordReset(), { wrapper: createWrapper() });

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ token: 'expired-token', new_password: 'NewPass1!' });
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBeDefined();
    expect((thrownError as { code: string }).code).toBe('INVALID_TOKEN');
  });

  // AUTH-FE-076: 500 エラー時に ApiClientError が投げられること。
  it('AUTH-FE-076: 500 エラー時に ApiClientError が投げられる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useExecutePasswordReset(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ token: 'valid-token', new_password: 'NewPass1!' }),
      ).rejects.toThrow();
    });
  });
});
