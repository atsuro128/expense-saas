// 経費レポートに関する React Query Hook のスタブ実装。
// 本実装は Step9 で行う。現時点では型定義のみを提供し、テスト時には vi.mock でモックする。

import type { ApiListResponse, ApiResponse, ExpenseReportDetail, ExpenseReportSummary } from '../api/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

// useMyReports のパラメータ型。
export interface MyReportsParams {
  page?: number;
  perPage?: number;
  status?: string;
  from?: string;
  to?: string;
}

// useMyReports: GET /api/reports — 自分のレポート一覧を取得する Hook のスタブ。
// スタブ実装では常に空データを返す。
export function useMyReports(_params?: MyReportsParams): UseQueryResult<ApiListResponse<ExpenseReportSummary>> {
  throw new Error('useMyReports is not implemented yet');
}

// useReport: GET /api/reports/:id — レポート詳細を取得する Hook のスタブ。
export function useReport(_reportId?: string): UseQueryResult<ApiResponse<ExpenseReportDetail>> {
  throw new Error('useReport is not implemented yet');
}

// useCreateReport のミューテーション入力型。
export interface CreateReportInput {
  title: string;
  periodStart: string;
  periodEnd: string;
  referenceReportId?: string;
}

// useCreateReport: POST /api/reports — レポート作成 Hook のスタブ。
export function useCreateReport(): UseMutationResult<{ id: string }, Error, CreateReportInput> {
  throw new Error('useCreateReport is not implemented yet');
}

// useUpdateReport のミューテーション入力型。
export interface UpdateReportInput {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
}

// useUpdateReport: PUT /api/reports/:id — レポート更新 Hook のスタブ。
export function useUpdateReport(): UseMutationResult<ExpenseReportDetail, Error, UpdateReportInput> {
  throw new Error('useUpdateReport is not implemented yet');
}

// useSubmitReport のミューテーション入力型。
export interface SubmitReportInput {
  id: string;
  updatedAt: string;
}

// useSubmitReport: POST /api/reports/:id/submit — レポート提出 Hook のスタブ。
export function useSubmitReport(): UseMutationResult<ExpenseReportDetail, Error, SubmitReportInput> {
  throw new Error('useSubmitReport is not implemented yet');
}

// useDeleteReport: DELETE /api/reports/:id — レポート削除 Hook のスタブ。
export function useDeleteReport(): UseMutationResult<void, Error, string> {
  throw new Error('useDeleteReport is not implemented yet');
}
