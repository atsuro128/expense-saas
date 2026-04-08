// 経費レポートに関する React Query Hook のスタブ実装。
// 本実装は Step9 で行う。現時点では型定義のみを提供し、テスト時には vi.mock でモックする。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiListResponse, ApiResponse, ExpenseReportDetail, ExpenseReportSummary, PendingReport, PayableReport } from '../api/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

// useMyReports のパラメータ型。
export interface MyReportsParams {
  page?: number;
  per_page?: number;
  status?: string;
  from?: string;
  to?: string;
}

// useMyReports: GET /api/reports — 自分のレポート一覧を取得する Hook のスタブ。
// スタブ実装では常に空データを返す。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useMyReports(_params?: MyReportsParams): UseQueryResult<ApiListResponse<ExpenseReportSummary>> {
  throw new Error('useMyReports is not implemented yet');
}

// useReport: GET /api/reports/:id — レポート詳細を取得する Hook のスタブ。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useReport(_reportId?: string): UseQueryResult<ApiResponse<ExpenseReportDetail>> {
  throw new Error('useReport is not implemented yet');
}

// useCreateReport のミューテーション入力型。
export interface CreateReportInput {
  title: string;
  period_start: string;
  period_end: string;
  reference_report_id?: string;
}

// useCreateReport: POST /api/reports — レポート作成 Hook のスタブ。
export function useCreateReport(): UseMutationResult<{ id: string }, Error, CreateReportInput> {
  throw new Error('useCreateReport is not implemented yet');
}

// useUpdateReport のミューテーション入力型。
export interface UpdateReportInput {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  updated_at: string;
}

// useUpdateReport: PUT /api/reports/:id — レポート更新 Hook のスタブ。
export function useUpdateReport(): UseMutationResult<ExpenseReportDetail, Error, UpdateReportInput> {
  throw new Error('useUpdateReport is not implemented yet');
}

// useSubmitReport のミューテーション入力型。
export interface SubmitReportInput {
  id: string;
  updated_at: string;
}

// useSubmitReport: POST /api/reports/:id/submit — レポート提出 Hook のスタブ。
export function useSubmitReport(): UseMutationResult<ExpenseReportDetail, Error, SubmitReportInput> {
  throw new Error('useSubmitReport is not implemented yet');
}

// useDeleteReport: DELETE /api/reports/:id — レポート削除 Hook のスタブ。
export function useDeleteReport(): UseMutationResult<void, Error, string> {
  throw new Error('useDeleteReport is not implemented yet');
}

// usePendingReports のパラメータ型。
export interface PendingReportListParams {
  page?: number;
  per_page?: number;
  applicant_name?: string;
}

/**
 * usePendingReports は GET /api/workflow/pending を呼び出す。
 * state-management.md §クエリキー設計: ['workflow', 'pending', params], staleTime 30秒。
 */
export function usePendingReports(params: PendingReportListParams = {}): UseQueryResult<ApiListResponse<PendingReport>> {
  const { page, per_page, applicant_name } = params;

  // クエリパラメータを構築する。
  const searchParams = new URLSearchParams();
  if (page !== undefined) searchParams.set('page', String(page));
  if (per_page !== undefined) searchParams.set('per_page', String(per_page));
  if (applicant_name !== undefined) searchParams.set('applicant_name', applicant_name);

  const qs = searchParams.toString();
  const url = qs ? `/api/workflow/pending?${qs}` : '/api/workflow/pending';

  return useQuery<ApiListResponse<PendingReport>>({
    queryKey: ['workflow', 'pending', params],
    queryFn: () => api.get<ApiListResponse<PendingReport>>(url),
    staleTime: 30 * 1000,
  });
}

// usePayableReports のパラメータ型。
export interface PayableReportListParams {
  page?: number;
  per_page?: number;
  applicant_name?: string;
}

/**
 * usePayableReports は GET /api/workflow/payable を呼び出す。
 * state-management.md §クエリキー設計: ['workflow', 'payable', params], staleTime 30秒。
 */
export function usePayableReports(params: PayableReportListParams = {}): UseQueryResult<ApiListResponse<PayableReport>> {
  const { page, per_page, applicant_name } = params;

  // クエリパラメータを構築する。
  const searchParams = new URLSearchParams();
  if (page !== undefined) searchParams.set('page', String(page));
  if (per_page !== undefined) searchParams.set('per_page', String(per_page));
  if (applicant_name !== undefined) searchParams.set('applicant_name', applicant_name);

  const qs = searchParams.toString();
  const url = qs ? `/api/workflow/payable?${qs}` : '/api/workflow/payable';

  return useQuery<ApiListResponse<PayableReport>>({
    queryKey: ['workflow', 'payable', params],
    queryFn: () => api.get<ApiListResponse<PayableReport>>(url),
    staleTime: 30 * 1000,
  });
}
