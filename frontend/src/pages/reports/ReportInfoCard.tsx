// レポート情報カードコンポーネント。
// ReportBasicInfo（基本情報）とワークフロー情報（提出・承認・却下・支払）を統合して表示する。
// SCR-RPT-004 に対応する。

import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import StatusChip from '../../components/ui/StatusChip';
import type { ExpenseReportDetail } from '../../api/types';

export interface ReportInfoCardProps {
  report: ExpenseReportDetail;
}

/**
 * ISO 日時文字列を日本語形式（YYYY年MM月DD日 HH:mm）にフォーマットする。
 */
function formatDateTimeJa(isoStr: string): string {
  return new Date(isoStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * ISO 日付文字列（YYYY-MM-DD または ISO 8601）を YYYY/MM/DD 形式に変換する。
 * 時刻部分を除いた日付のみを表示する。
 */
function formatDateSlash(isoStr: string): string {
  // ISO 文字列の先頭 10 文字（YYYY-MM-DD）を取得してスラッシュに変換する。
  const datePart = isoStr.slice(0, 10);
  return datePart.replace(/-/g, '/');
}

/**
 * ReportInfoCard はレポートの基本情報とワークフロー情報を統合して表示する。
 * - ReportBasicInfo に相当する情報: タイトル・ステータス・期間・金額・提出者・作成日
 * - ワークフロー情報: 提出日・承認者/日・却下者/日/理由・支払処理者/日
 * - 再申請元リンク: reference_report_id が存在する場合のみ表示
 */
export default function ReportInfoCard({ report }: ReportInfoCardProps) {
  // ワークフロー情報が存在するかどうか（draft 状態では表示しない）。
  const hasWorkflowInfo =
    report.submitted_at ||
    report.approved_by ||
    report.rejected_by ||
    report.paid_by;

  return (
    <div data-testid="report-info-card">
      {/* 基本情報セクション */}
      <div data-testid="report-basic-info">
        <h2>{report.title}</h2>
        <span data-testid="status-chip">
          <StatusChip status={report.status} />
        </span>
        {/* 対象期間: YYYY/MM/DD 〜 YYYY/MM/DD 形式で表示 */}
        <p>
          対象期間: {formatDateSlash(report.period_start)} 〜 {formatDateSlash(report.period_end)}
        </p>
        {/* 合計金額 */}
        <p data-testid="total-amount">合計金額: ¥{report.total_amount.toLocaleString()}</p>
        {/* 作成者名 */}
        <p>作成者: {report.submitter?.name ?? ''}</p>
        {/* 作成日（YYYY/MM/DD HH:mm 形式） */}
        <p>作成日: {formatDateTimeJa(report.created_at)}</p>
      </div>

      {/* 再申請元リンク（reference_report_id が存在する場合のみ表示） */}
      {report.reference_report_id && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" component="span">
            再申請元:{' '}
          </Typography>
          <Link to={`/reports/${report.reference_report_id}`}>元レポートを表示</Link>
        </Box>
      )}

      {/* ワークフロー情報（提出・承認・却下・支払の各フェーズを条件付きで表示） */}
      {hasWorkflowInfo && (
        <Paper
          variant="outlined"
          sx={{ mt: 2, p: 2 }}
          data-testid="report-workflow-info"
        >
          {/* 提出日 */}
          {report.submitted_at && (
            <Typography variant="body2" data-testid="submitted-at">
              提出日: {formatDateTimeJa(report.submitted_at)}
            </Typography>
          )}

          {/* 承認情報（approved_by が存在する場合） */}
          {report.approved_by && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">承認者: {report.approved_by.name}</Typography>
              {report.approved_at && (
                <Typography variant="body2">
                  承認日: {formatDateTimeJa(report.approved_at)}
                </Typography>
              )}
              {report.approval_comment && (
                <Typography variant="body2">
                  承認コメント: {report.approval_comment}
                </Typography>
              )}
            </Box>
          )}

          {/* 却下情報（rejected_by が存在する場合、赤色背景で表示） */}
          {report.rejected_by && (
            <Box sx={{ mt: 1, p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography variant="body2">却下者: {report.rejected_by.name}</Typography>
              {report.rejected_at && (
                <Typography variant="body2">
                  却下日: {formatDateTimeJa(report.rejected_at)}
                </Typography>
              )}
              {report.rejection_reason && (
                <Typography
                  variant="body2"
                  data-testid="rejection-reason"
                >
                  却下理由: {report.rejection_reason}
                </Typography>
              )}
            </Box>
          )}

          {/* 支払情報（paid_by が存在する場合） */}
          {report.paid_by && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">支払処理者: {report.paid_by.name}</Typography>
              {report.paid_at && (
                <Typography variant="body2">
                  支払日: {formatDateTimeJa(report.paid_at)}
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      )}
    </div>
  );
}
