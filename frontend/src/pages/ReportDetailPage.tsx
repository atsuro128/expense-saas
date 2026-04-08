// レポート詳細ページ。
// RPT-FE-064〜069 の仕様に対応する。
// レポートデータを取得し、提出・削除の操作を管理する。

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PageSkeleton from '../components/ui/PageSkeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useReport, useSubmitReport, useDeleteReport } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';

/** ダイアログの操作種別 */
type DialogAction = 'submit' | 'delete' | null;

/**
 * ReportDetailPage はレポート詳細情報と操作ボタンを表示する画面。
 * 提出・削除操作は確認ダイアログを通じて実行する。
 */
export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 現在のユーザー情報を取得する。
  const { user } = useAuth();

  // ダイアログ表示状態。
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);

  // レポートデータを取得する。
  const { data, isLoading, isError } = useReport(id);
  const report = data?.data;

  // ミューテーション。
  const { mutate: submitMutate } = useSubmitReport();
  const { mutate: deleteMutate } = useDeleteReport();

  // ローディング中はスケルトン表示。
  if (isLoading) {
    return <PageSkeleton variant="card" />;
  }

  // 404 エラー時は Not Found メッセージを表示する。
  if (isError) {
    return (
      <Box>
        <Typography>指定されたデータが見つかりません。</Typography>
        <Link to="/reports">レポート一覧</Link>
      </Box>
    );
  }

  if (!report) {
    return null;
  }

  /**
   * 提出確認後の処理。キャッシュを更新してダイアログを閉じる。
   */
  const handleSubmitConfirm = () => {
    submitMutate(
      { id: report.id, updated_at: report.updated_at },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['reports', 'detail', report.id] });
          setDialogAction(null);
        },
        onError: () => {
          setDialogAction(null);
        },
      },
    );
  };

  /**
   * 削除確認後の処理。成功後は /reports に遷移する。
   */
  const handleDeleteConfirm = () => {
    deleteMutate(report.id, {
      onSuccess: () => {
        navigate('/reports');
      },
      onError: () => {
        setDialogAction(null);
      },
    });
  };

  /**
   * ダイアログの「はい」ボタン押下時の処理。
   */
  const handleDialogConfirm = () => {
    if (dialogAction === 'submit') {
      handleSubmitConfirm();
    } else if (dialogAction === 'delete') {
      handleDeleteConfirm();
    }
  };

  // 現在のユーザーがオーナーかどうか（draft 状態で操作可能）。
  const isOwner = user?.id === report.submitter?.id;
  const isDraft = report.status === 'draft';

  return (
    <Box>
      {/* レポート情報カード */}
      <Box data-testid="report-info-card" sx={{ mb: 3 }}>
        <Typography variant="h5">{report.title}</Typography>
        <Typography>
          対象期間: {report.period_start} 〜 {report.period_end}
        </Typography>
        <Typography>ステータス: {report.status}</Typography>
        <Typography>合計金額: {report.total_amount.toLocaleString()} 円</Typography>
      </Box>

      {/* アクションバー */}
      <Box data-testid="report-action-bar" sx={{ display: 'flex', gap: 1 }}>
        {isOwner && isDraft && (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setDialogAction('submit')}
            >
              提出する
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setDialogAction('delete')}
            >
              削除する
            </Button>
          </>
        )}
      </Box>

      {/* 操作確認ダイアログ */}
      <ConfirmDialog
        open={dialogAction !== null}
        title={dialogAction === 'submit' ? 'レポートを提出しますか？' : 'レポートを削除しますか？'}
        message={
          dialogAction === 'submit'
            ? 'このレポートを提出します。提出後は編集できません。'
            : 'このレポートを削除します。この操作は取り消せません。'
        }
        confirmLabel="はい"
        confirmColor={dialogAction === 'delete' ? 'error' : 'primary'}
        cancelLabel="キャンセル"
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogAction(null)}
      />
    </Box>
  );
}
