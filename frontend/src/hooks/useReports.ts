// 経費レポートに関する React Query Hook の本実装。
// TanStack Query（useQuery/useMutation）と api クライアントを使用する。

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiListResponse, ApiResponse, ExpenseReportDetail, ExpenseReportSummary, PendingReport, PayableReport, ProcessedReport } from '../api/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

// useMyReports のパラメータ型。
export interface MyReportsParams {
  page?: number;
  per_page?: number;
  status?: string;
  from?: string;
  to?: string;
}

/**
 * useMyReports: GET /api/reports — 自分のレポート一覧を取得する Hook。
 * queryKey: ['reports', 'mine', params]
 */
export function useMyReports(params: MyReportsParams = {}): UseQueryResult<ApiListResponse<ExpenseReportSummary>> {
  const { page, per_page, status, from, to } = params;

  // クエリパラメータを構築する。
  const searchParams = new URLSearchParams();
  if (page !== undefined) searchParams.set('page', String(page));
  if (per_page !== undefined) searchParams.set('per_page', String(per_page));
  if (status) searchParams.set('status', status);
  if (from) searchParams.set('from', from);
  if (to) searchParams.set('to', to);

  const qs = searchParams.toString();
  const url = qs ? `/api/reports?${qs}` : '/api/reports';

  return useQuery<ApiListResponse<ExpenseReportSummary>>({
    queryKey: ['reports', 'mine', params],
    queryFn: () => api.get<ApiListResponse<ExpenseReportSummary>>(url),
  });
}

/**
 * useReport: GET /api/reports/:id — レポート詳細を取得する Hook。
 * queryKey: ['reports', 'detail', id]
 */
export function useReport(reportId?: string): UseQueryResult<ApiResponse<ExpenseReportDetail>> {
  return useQuery<ApiResponse<ExpenseReportDetail>>({
    queryKey: ['reports', 'detail', reportId],
    queryFn: () => api.get<ApiResponse<ExpenseReportDetail>>(`/api/reports/${reportId}`),
    enabled: !!reportId,
  });
}

// useCreateReport のミューテーション入力型。
export interface CreateReportInput {
  title: string;
  period_start: string;
  period_end: string;
  reference_report_id?: string;
}

/**
 * useCreateReport: POST /api/reports — レポート作成 Hook。
 * 成功時: ['reports', 'mine'] と ['dashboard'] のキャッシュを無効化する。
 */
export function useCreateReport(): UseMutationResult<{ id: string }, Error, CreateReportInput> {
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, CreateReportInput>({
    mutationFn: async (input: CreateReportInput) => {
      const body: Record<string, unknown> = {
        title: input.title,
        period_start: input.period_start,
        period_end: input.period_end,
      };
      if (input.reference_report_id) {
        body['reference_report_id'] = input.reference_report_id;
      }
      const res = await api.post<ApiResponse<{ id: string }>>('/api/reports', body);
      return res.data;
    },
    onSuccess: () => {
      // レポート一覧・ダッシュボードのクエリキャッシュを無効化する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// useUpdateReport のミューテーション入力型。
export interface UpdateReportInput {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  updated_at: string;
}

/**
 * useUpdateReport: PUT /api/reports/:id — レポート更新 Hook。
 * 成功時: ['reports', 'detail', id]・['reports', 'mine'] のキャッシュを無効化する。
 */
export function useUpdateReport(): UseMutationResult<ExpenseReportDetail, Error, UpdateReportInput> {
  const queryClient = useQueryClient();

  return useMutation<ExpenseReportDetail, Error, UpdateReportInput>({
    mutationFn: async (input: UpdateReportInput) => {
      const body = {
        title: input.title,
        period_start: input.period_start,
        period_end: input.period_end,
        updated_at: input.updated_at,
      };
      const res = await api.put<ApiResponse<ExpenseReportDetail>>(`/api/reports/${input.id}`, body);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      // レポート詳細・一覧のクエリキャッシュを無効化する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
    },
  });
}

// useSubmitReport のミューテーション入力型。
export interface SubmitReportInput {
  id: string;
  updated_at: string;
}

/**
 * useSubmitReport: POST /api/reports/:id/submit — レポート提出 Hook。
 * 成功時: ['reports', 'detail', id]・['reports', 'mine']・['dashboard']・['workflow', 'pending'] のキャッシュを無効化する。
 */
export function useSubmitReport(): UseMutationResult<ExpenseReportDetail, Error, SubmitReportInput> {
  const queryClient = useQueryClient();

  return useMutation<ExpenseReportDetail, Error, SubmitReportInput>({
    mutationFn: async (input: SubmitReportInput) => {
      const res = await api.post<ApiResponse<ExpenseReportDetail>>(
        `/api/reports/${input.id}/submit`,
        { updated_at: input.updated_at },
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      // レポート詳細・一覧・ダッシュボード・承認待ちのクエリキャッシュを無効化する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'pending'] });
    },
  });
}

/**
 * useDeleteReport: DELETE /api/reports/:id — レポート削除 Hook。
 * 成功時: ['reports', 'mine'] と ['dashboard'] のキャッシュを無効化する。
 */
export function useDeleteReport(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (reportId: string) => {
      await api.delete<void>(`/api/reports/${reportId}`);
    },
    onSuccess: () => {
      // レポート一覧・ダッシュボードのクエリキャッシュを無効化する。
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
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

// useProcessedReports のパラメータ型。
// SCR-WFL-003（処理済みレポート一覧）で使用する。フィルタは MVP では実装しない。
export interface ProcessedReportListParams {
  page?: number;
  per_page?: number;
}

/**
 * useProcessedReports は GET /api/workflow/processed を呼び出す。
 * state-management.md §クエリキー設計: ['workflow', 'processed', params], staleTime 30秒。
 * SCR-WFL-003（処理済みレポート一覧）で使用する。
 */
export function useProcessedReports(params: ProcessedReportListParams = {}): UseQueryResult<ApiListResponse<ProcessedReport>> {
  const { page, per_page } = params;

  // クエリパラメータを構築する。
  const searchParams = new URLSearchParams();
  if (page !== undefined) searchParams.set('page', String(page));
  if (per_page !== undefined) searchParams.set('per_page', String(per_page));

  const qs = searchParams.toString();
  const url = qs ? `/api/workflow/processed?${qs}` : '/api/workflow/processed';

  return useQuery<ApiListResponse<ProcessedReport>>({
    queryKey: ['workflow', 'processed', params],
    queryFn: () => api.get<ApiListResponse<ProcessedReport>>(url),
    staleTime: 30 * 1000,
  });
}
