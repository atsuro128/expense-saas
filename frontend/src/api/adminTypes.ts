// テナント管理・全レポート一覧関連の型定義。
// admin-all-reports.md §AllReportsTable を参照。

import type { ReportStatus, UserSummary } from './types';

/** テナント全レポート一覧の行データ。 */
export interface AllReportRow {
  /** レポート ID */
  id: string;
  /** レポートタイトル */
  title: string;
  /** 申請者情報 */
  submitter: UserSummary;
  /** 合計金額（円） */
  totalAmount: number;
  /** レポートステータス */
  status: ReportStatus;
  /** 提出日（ISO 8601 形式、または null） */
  submittedAt: string | null;
  /** 作成日（ISO 8601 形式） */
  createdAt: string;
}
