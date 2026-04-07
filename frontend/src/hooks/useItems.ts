// 経費明細に関する React Query ミューテーション Hook。
// state-management.md §3 ミューテーション系に準拠する。
// invalidate: ['reports', 'detail', reportId]

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiResponse, ExpenseItemWithAttachments, ExpenseItemCreateRequest, ExpenseItemUpdateRequest } from '../api/types';

// useCreateItem の入力型。
export interface CreateItemInput extends ExpenseItemCreateRequest {
  /** レポート ID */
  reportId: string;
}

// useUpdateItem の入力型。
export interface UpdateItemInput extends ExpenseItemUpdateRequest {
  /** レポート ID */
  reportId: string;
  /** 明細 ID */
  itemId: string;
}

// useDeleteItem の入力型。
export interface DeleteItemInput {
  /** レポート ID */
  reportId: string;
  /** 明細 ID */
  itemId: string;
}

// useCreateItem: POST /api/reports/:id/items — 明細を新規追加する Hook。
// 成功時に ['reports', 'detail', reportId] のキャッシュを無効化する。
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemInput): Promise<ExpenseItemWithAttachments> => {
      const { reportId, ...body } = input;
      const res = await api.post<ApiResponse<ExpenseItemWithAttachments>>(
        `/api/reports/${reportId}/items`,
        body,
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      // レポート詳細のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.reportId] });
    },
  });
}

// useUpdateItem: PUT /api/reports/:id/items/:itemId — 明細を更新する Hook。
// 成功時に ['reports', 'detail', reportId] のキャッシュを無効化する。
export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateItemInput): Promise<ExpenseItemWithAttachments> => {
      const { reportId, itemId, ...body } = input;
      const res = await api.put<ApiResponse<ExpenseItemWithAttachments>>(
        `/api/reports/${reportId}/items/${itemId}`,
        body,
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      // レポート詳細のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.reportId] });
    },
  });
}

// useDeleteItem: DELETE /api/reports/:id/items/:itemId — 明細を削除する Hook。
// 成功時に ['reports', 'detail', reportId] のキャッシュを無効化する。
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteItemInput): Promise<void> => {
      const { reportId, itemId } = input;
      await api.delete<void>(`/api/reports/${reportId}/items/${itemId}`);
    },
    onSuccess: (_data, variables) => {
      // レポート詳細のクエリキャッシュを無効化する
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.reportId] });
    },
  });
}
