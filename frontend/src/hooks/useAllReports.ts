// useAllReports Hook: GET /api/reports/all を呼び出してテナント全レポート一覧を取得する。
// Admin および Accounting ロールが利用可能（authz.md §6.3）。
// フィルタ・ページネーションパラメータをサポートする。

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiListResponse } from '../api/types';
import type { AllReportRow } from '../api/adminTypes';

/** useAllReports のクエリパラメータ。 */
export interface AllReportsParams {
  /** ページ番号（1始まり）。デフォルト: 1 */
  page?: number;
  /** 1ページあたりの件数。デフォルト: 20 */
  per_page?: number;
  /** ステータスフィルタ。空文字は全て */
  status?: string;
  /** 期間（開始日）。YYYY-MM-DD 形式 */
  from?: string | null;
  /** 期間（終了日）。YYYY-MM-DD 形式 */
  to?: string | null;
  /** 申請者 ID フィルタ。空文字は全て */
  submitter_id?: string;
}

/**
 * useAllReports は GET /api/reports/all を呼び出すクエリ Hook。
 * フィルタ・ページネーションパラメータを受け取り、テナント全レポート一覧を返す。
 */
export function useAllReports(params: AllReportsParams = {}) {
  const { page = 1, per_page = 20, status, from, to, submitter_id } = params;

  // クエリパラメータを構築する。
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(page));
  searchParams.set('per_page', String(per_page));
  if (status) searchParams.set('status', status);
  if (from) searchParams.set('from', from);
  if (to) searchParams.set('to', to);
  if (submitter_id) searchParams.set('submitter_id', submitter_id);

  const queryString = searchParams.toString();
  const url = `/api/reports/all?${queryString}`;

  return useQuery({
    queryKey: ['allReports', page, per_page, status, from, to, submitter_id],
    queryFn: async () => {
      return api.get<ApiListResponse<AllReportRow>>(url);
    },
  });
}
