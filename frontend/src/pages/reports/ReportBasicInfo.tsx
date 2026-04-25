// レポート基本情報コンポーネント。
// SCR-RPT-004 に対応する。

import type { ReportStatus } from '../../api/types';
import StatusChip from '../../components/ui/StatusChip';

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
 * createdAt は日本語ロケール形式（YYYY年MM月DD日 HH:mm）で表示する。
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
  // createdAt を YYYY/MM/DD HH:mm の JST 表示でフォーマットする。
  // timeZone: 'Asia/Tokyo' を明示することで実行環境の TZ に依存せず常に JST 表示を保つ
  // （仕様: 設計書 60_test/test_cases/reports.md 注記「タイムゾーンは JST 表示」）。
  const formattedCreatedAt = new Date(createdAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });

  return (
    <div>
      <h2>{title}</h2>
      <span data-testid="status-chip">
        <StatusChip status={status} />
      </span>
      {/* 対象期間: YYYY/MM/DD 〜 YYYY/MM/DD 形式で表示 */}
      <p>
        対象期間: {periodStart} 〜 {periodEnd}
      </p>
      {/* 合計金額 */}
      <p data-testid="total-amount">合計金額: ¥{totalAmount.toLocaleString()}</p>
      {/* 作成者名 */}
      <p>作成者: {submitterName}</p>
      {/* 作成日（YYYY/MM/DD HH:mm 形式） */}
      <p>作成日: {formattedCreatedAt}</p>
    </div>
  );
}
