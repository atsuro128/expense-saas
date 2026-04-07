// useTenantMembers Hook のユニットテスト。
// TNT-FE-039〜041 に対応する。
// fetch をモックして API 呼び出しをシミュレートする。

import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import { useTenantMembers } from '../useTenantMembers';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// staleTime テスト用: 同一 QueryClient でラップする。
function createSharedWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const mockMembersResponse = {
  data: [
    { id: 'u1', name: 'User1' },
    { id: 'u2', name: 'User2' },
  ],
};

describe('useTenantMembers', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // TNT-FE-039: GET /api/tenant/members が成功した場合、data に UserSummary 配列が返ること。
  it('TNT-FE-039: GET /api/tenant/members が成功したとき data.data に UserSummary 配列が返る', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockMembersResponse,
    } as unknown as Response);

    const { result } = renderHook(() => useTenantMembers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // data.data が UserSummary 配列で 2 件であること。
    expect(result.current.data?.data).toHaveLength(2);

    // 各要素に id と name が含まれること。
    const members = result.current.data?.data;
    expect(members?.[0]).toHaveProperty('id');
    expect(members?.[0]).toHaveProperty('name');
    expect(members?.[1]).toHaveProperty('id');
    expect(members?.[1]).toHaveProperty('name');
  });

  // TNT-FE-040: 2回目のレンダリングでは API が再呼び出しされないこと（staleTime 60秒のキャッシュ）。
  it('TNT-FE-040: staleTime 60 秒のキャッシュが有効で 2 回目のレンダリングでは API が再呼び出しされない', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockMembersResponse,
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    const { wrapper } = createSharedWrapper();

    // 1 回目のレンダリング。
    const { result: result1 } = renderHook(() => useTenantMembers(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    // 2 回目のレンダリング（同一 QueryClient = キャッシュが有効）。
    const { result: result2 } = renderHook(() => useTenantMembers(), { wrapper });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    // fetch は 1 回だけ呼ばれること（staleTime 60秒のキャッシュが有効）。
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // TNT-FE-041: API エラー時に error が非 null であること。
  it('TNT-FE-041: GET /api/tenant/members が 500 を返したとき error が非 null で isError が true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }),
    } as unknown as Response);

    const { result } = renderHook(() => useTenantMembers(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.isError).toBe(true);
  });
});
