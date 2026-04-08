// レポート詳細ページ。
// report-detail.md §ReportDetailPage 準拠の最小構造。
// Step 10 で本実装に置き換える。

import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useReport, useSubmitReport, useDeleteReport } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';

/**
 * ReportDetailPage はレポート詳細画面のルートコンポーネント。
 * レポートデータを読み込み子コンポーネントに伝播する。
 * ワークフロー操作（提出・削除）の確認ダイアログ制御を担う。
 */
export default function ReportDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  // useAuth はスタブ実装のため user プロパティが型に存在しない。
  // テスト時はモックで user を注入するため、実行時に取得する。
  const authResult = useAuth() as { isAuthenticated: boolean; user?: { id: string; role: string } };

  const { data, isLoading, isError, error } = useReport(id);
  const { mutate: submitReport } = useSubmitReport();
  const { mutate: deleteReport } = useDeleteReport();

  // 確認ダイアログの状態管理。
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'submit' | 'delete' | null>(null);

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return <div data-testid="page-skeleton" data-variant="card" />;
  }

  // エラー時の処理。
  if (isError) {
    const apiError = error as (Error & { status?: number; code?: string }) | null;
    if (apiError?.status === 404 || apiError?.code === 'RESOURCE_NOT_FOUND') {
      return (
        <div>
          <p>指定されたデータが見つかりません。</p>
          <Link to="/reports">レポート一覧へ戻る</Link>
        </div>
      );
    }
    return (
      <div data-testid="app-toast" data-severity="error">
        {apiError instanceof Error ? apiError.message : 'エラーが発生しました'}
      </div>
    );
  }

  const report = data?.data;
  if (!report) {
    return null;
  }

  // 提出ボタン押下時の処理。
  const handleSubmitClick = () => {
    setDialogAction('submit');
    setDialogOpen(true);
  };

  // 削除ボタン押下時の処理。
  const handleDeleteClick = () => {
    setDialogAction('delete');
    setDialogOpen(true);
  };

  // ダイアログ確認時の処理。
  const handleConfirm = () => {
    if (dialogAction === 'submit') {
      submitReport(
        { id: report.id, updated_at: report.updated_at },
        {
          onSuccess: () => {
            setDialogOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['reports', 'detail', report.id] });
          },
        },
      );
    } else if (dialogAction === 'delete') {
      deleteReport(report.id, {
        onSuccess: () => {
          setDialogOpen(false);
          navigate('/reports');
        },
      });
    }
  };

  // ダイアログキャンセル時の処理。
  const handleCancel = () => {
    setDialogOpen(false);
    setDialogAction(null);
  };

  // 提出ボタンの表示条件: draft 状態かつ所有者の場合。
  const isOwner = authResult.user && report.submitter?.id === authResult.user.id;
  const canSubmit = report.status === 'draft' && isOwner;
  const canDelete = report.status === 'draft' && isOwner;

  return (
    <Box>
      {/* レポート情報カード */}
      <Box data-testid="report-info-card" sx={{ mb: 2 }}>
        <h1>{report.title}</h1>
        <p>期間: {report.period_start} 〜 {report.period_end}</p>
        <p>ステータス: {report.status}</p>
        <p>金額: {report.total_amount}</p>
      </Box>

      {/* アクションバー */}
      <Box data-testid="report-action-bar" sx={{ display: 'flex', gap: 2 }}>
        {canSubmit && (
          <Button variant="contained" onClick={handleSubmitClick}>
            提出
          </Button>
        )}
        {canDelete && (
          <Button variant="outlined" color="error" onClick={handleDeleteClick}>
            削除
          </Button>
        )}
      </Box>

      {/* 確認ダイアログ */}
      {dialogOpen && (
        <div role="dialog" aria-modal="true">
          <p>
            {dialogAction === 'submit' ? 'このレポートを提出しますか？' : 'このレポートを削除しますか？'}
          </p>
          <Button onClick={handleConfirm}>はい</Button>
          <Button onClick={handleCancel}>キャンセル</Button>
        </div>
      )}
    </Box>
  );
}
