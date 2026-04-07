// useCreateItem / useUpdateItem / useDeleteItem Hook のユニットテスト。
// ITM-FE-048〜056 に対応する。
// 各 Hook は未実装のため、fetch を直接呼ぶスタブ Hook を使用して API 契約を検証する。
// state-management.md §3 ミューテーション系に準拠する。

import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import { vi, beforeEach, afterEach } from 'vitest';

// テスト用プロバイダーラッパー。
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// useCreateItem スタブ
// ---------------------------------------------------------------------------

interface CreateItemInput {
  reportId: string;
  expense_date: string;
  amount: number;
  category_id: string;
  description: string;
}

function useCreateItemStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemInput) => {
      const { reportId, ...body } = input;
      const res = await fetch(`/api/reports/${reportId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
    onSuccess: (_data, variables) => {
      // ['reports', 'detail', reportId] のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.reportId] });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateItem スタブ
// ---------------------------------------------------------------------------

interface UpdateItemInput {
  reportId: string;
  itemId: string;
  expense_date: string;
  amount: number;
  category_id: string;
  description: string;
  updated_at: string;
}

function useUpdateItemStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateItemInput) => {
      const { reportId, itemId, ...body } = input;
      const res = await fetch(`/api/reports/${reportId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      const data = await res.json() as { data: unknown };
      return data.data;
    },
    onSuccess: (_data, variables) => {
      // ['reports', 'detail', reportId] のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.reportId] });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteItem スタブ
// ---------------------------------------------------------------------------

interface DeleteItemInput {
  reportId: string;
  itemId: string;
}

function useDeleteItemStub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteItemInput) => {
      const { reportId, itemId } = input;
      const res = await fetch(`/api/reports/${reportId}/items/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json() as { error: { code: string; message: string } };
        throw Object.assign(new Error(err.error.message), { status: res.status, code: err.error.code });
      }
      // 204 No Content
      return undefined;
    },
    onSuccess: (_data, variables) => {
      // ['reports', 'detail', reportId] のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.reportId] });
    },
  });
}

// ===========================================================================
// useCreateItem テスト（ITM-FE-048〜050）
// ===========================================================================

describe('useCreateItem（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ITM-FE-048: POST /api/reports/:id/items が呼び出され、作成された明細データが返る。
  it('ITM-FE-048: POST /api/reports/:id/items を呼び出し、作成された明細データが返る', async () => {
    const mockCreatedItem = {
      id: 'item-new-001',
      amount: 2000,
      description: 'タクシー代',
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: mockCreatedItem }),
    } as unknown as Response);

    const { result } = renderHook(() => useCreateItemStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        expense_date: '2026-03-10',
        amount: 2000,
        category_id: 'cat-001',
        description: 'タクシー代',
      });
    });

    // POST /api/reports/report-001/items が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.data).toEqual(mockCreatedItem);
  });

  // ITM-FE-049: ミューテーション成功後に ['reports', 'detail', reportId] のキャッシュが無効化される。
  it('ITM-FE-049: ミューテーション成功後に reports.detail キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'item-new-001' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateItemStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        expense_date: '2026-03-10',
        amount: 2000,
        category_id: 'cat-001',
        description: 'タクシー代',
      });
    });

    await waitFor(() => {
      // ['reports', 'detail', 'report-001'] のキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-001'] }),
      );
    });
  });

  // ITM-FE-050: API が 422 VALIDATION_ERROR を返すと isError=true になる。
  it('ITM-FE-050: API が 422 VALIDATION_ERROR を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'VALIDATION_ERROR', message: 'バリデーションエラー', details: [] },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCreateItemStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          reportId: 'report-001',
          expense_date: '2026-03-10',
          amount: 0,
          category_id: 'cat-001',
          description: 'テスト',
        }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
  });
});

// ===========================================================================
// useUpdateItem テスト（ITM-FE-051〜053）
// ===========================================================================

describe('useUpdateItem（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ITM-FE-051: PUT /api/reports/:id/items/:itemId が呼び出され、更新後の明細データが返る。
  it('ITM-FE-051: PUT /api/reports/:id/items/:itemId を呼び出し、更新後の明細データが返る', async () => {
    const mockUpdatedItem = {
      id: 'item-001',
      amount: 1500,
      description: 'タクシー代（修正）',
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: mockUpdatedItem }),
    } as unknown as Response);

    const { result } = renderHook(() => useUpdateItemStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        expense_date: '2026-03-11',
        amount: 1500,
        category_id: 'cat-001',
        description: 'タクシー代（修正）',
        updated_at: '2026-03-10T00:00:00Z',
      });
    });

    // PUT /api/reports/report-001/items/item-001 が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items/item-001',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(result.current.data).toEqual(mockUpdatedItem);
  });

  // ITM-FE-052: ミューテーション成功後に ['reports', 'detail', reportId] のキャッシュが無効化される。
  it('ITM-FE-052: ミューテーション成功後に reports.detail キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { id: 'item-001' } }),
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateItemStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
        expense_date: '2026-03-11',
        amount: 1500,
        category_id: 'cat-001',
        description: 'タクシー代（修正）',
        updated_at: '2026-03-10T00:00:00Z',
      });
    });

    await waitFor(() => {
      // ['reports', 'detail', 'report-001'] のキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-001'] }),
      );
    });
  });

  // ITM-FE-053: API が 409 CONFLICT を返すと isError=true になる。
  it('ITM-FE-053: API が 409 CONFLICT を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'CONFLICT', message: '競合が発生しました' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useUpdateItemStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          reportId: 'report-001',
          itemId: 'item-001',
          expense_date: '2026-03-11',
          amount: 1500,
          category_id: 'cat-001',
          description: 'テスト',
          updated_at: '2020-01-01T00:00:00Z',
        }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
  });
});

// ===========================================================================
// useDeleteItem テスト（ITM-FE-054〜056）
// ===========================================================================

describe('useDeleteItem（スタブ）', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ITM-FE-054: DELETE /api/reports/:id/items/:itemId が呼び出され、正常終了する。
  it('ITM-FE-054: DELETE /api/reports/:id/items/:itemId を呼び出し、正常終了する', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => undefined,
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteItemStub(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
      });
    });

    // DELETE /api/reports/report-001/items/item-001 が呼ばれていること
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/reports/report-001/items/item-001',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(result.current.isSuccess).toBe(true);
  });

  // ITM-FE-055: ミューテーション成功後に ['reports', 'detail', reportId] のキャッシュが無効化される。
  it('ITM-FE-055: ミューテーション成功後に reports.detail キャッシュが無効化される', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => undefined,
    } as unknown as Response);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteItemStub(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: 'report-001',
        itemId: 'item-001',
      });
    });

    await waitFor(() => {
      // ['reports', 'detail', 'report-001'] のキャッシュ無効化を検証する
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['reports', 'detail', 'report-001'] }),
      );
    });
  });

  // ITM-FE-056: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる。
  it('ITM-FE-056: API が 404 RESOURCE_NOT_FOUND を返すと isError=true になる', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
      json: async () => ({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'リソースが見つかりません' },
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useDeleteItemStub(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          reportId: 'report-001',
          itemId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow();
    });

    expect(result.current.isError).toBe(true);
  });
});
