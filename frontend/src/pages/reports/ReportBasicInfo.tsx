// レポート基本情報コンポーネント（スタブ）。
// SCR-RPT-004 に対応する。

import type { ReportStatus } from '../../api/types';

export interface ReportBasicInfoProps {
  title: string;
  status: ReportStatus;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  submitterName: string;
  createdAt: string;
}

/**
 * ReportBasicInfo はレポートのタイトル・ステータス・期間・金額・作成者・作成日を表示する。
 */
export default function ReportBasicInfo({
  title,
  status,
  periodStart,
  periodEnd,
  totalAmount,
  submitterName,
  createdAt,
}: ReportBasicInfoProps) {
  return (
    <div>
      <h2>{title}</h2>
      <span data-testid="status-chip">{status}</span>
      <p>
        {periodStart} 〜 {periodEnd}
      </p>
      <p data-testid="total-amount">{totalAmount.toLocaleString()}</p>
      <p>{submitterName}</p>
      <p>{createdAt}</p>
    </div>
  );
}
