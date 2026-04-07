// 経費明細に関する React Query Hook のスタブ実装。
// 本実装は Step 10 で行う。現時点では型定義のみを提供し、テスト時には vi.mock でモックする。
// state-management.md §3 ミューテーション系に準拠する。

import type { ApiResponse, ExpenseItemWithAttachments, ExpenseItemCreateRequest, ExpenseItemUpdateRequest } from '../api/types';
import type { UseMutationResult } from '@tanstack/react-query';

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

// useCreateItem: POST /api/reports/:id/items — 明細を新規追加する Hook のスタブ。
// invalidate: ['reports', 'detail', reportId]
export function useCreateItem(): UseMutationResult<ApiResponse<ExpenseItemWithAttachments>, Error, CreateItemInput> {
  throw new Error('useCreateItem is not implemented yet');
}

// useUpdateItem: PUT /api/reports/:id/items/:itemId — 明細を更新する Hook のスタブ。
// invalidate: ['reports', 'detail', reportId]
export function useUpdateItem(): UseMutationResult<ApiResponse<ExpenseItemWithAttachments>, Error, UpdateItemInput> {
  throw new Error('useUpdateItem is not implemented yet');
}

// useDeleteItem: DELETE /api/reports/:id/items/:itemId — 明細を削除する Hook のスタブ。
// invalidate: ['reports', 'detail', reportId]
export function useDeleteItem(): UseMutationResult<void, Error, DeleteItemInput> {
  throw new Error('useDeleteItem is not implemented yet');
}
