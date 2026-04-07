// テナント管理・全レポート一覧関連の型定義。
// admin-all-reports.md §AllReportsTable を参照。
// openapi.yaml の ExpenseReportSummary スキーマに準拠した snake_case プロパティを使用する。

import type { ReportStatus, UserSummary } from './types';

/** テナント全レポート一覧の行データ。openapi.yaml ExpenseReportSummary に準拠。 */
export interface AllReportRow {
  /** レポート ID */
  id: string;
  /** レポートタイトル */
  title: string;
  /** 申請者情報 */
  submitter: UserSummary;
  /** 合計金額（円）。openapi.yaml: total_amount */
  total_amount: number;
  /** レポートステータス */
  status: ReportStatus;
  /** 提出日（ISO 8601 形式、または null）。openapi.yaml: submitted_at */
  submitted_at: string | null;
  /** 作成日（ISO 8601 形式）。openapi.yaml: created_at */
  created_at: string;
}
