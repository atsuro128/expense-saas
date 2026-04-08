// レポート編集ページ。
// report-edit.md §ReportEditPage 準拠の最小構造。
// Step 10 で本実装に置き換える。

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useReport, useUpdateReport } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { showGlobalToast, clearGlobalToasts } from '../utils/globalToast';

/**
 * ReportEditPage はレポート編集画面のルートコンポーネント。
 * useReport で既存データを読み込み、フォームの defaultValues に渡す。
 * 所有者でない場合・draft でない場合はリダイレクトする。
 */
export default function ReportEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // useAuth はスタブ実装のため user プロパティが型に存在しない。
  // テスト時はモックで user を注入するため、実行時に取得する。
  const authResult = useAuth() as { isAuthenticated: boolean; user?: { id: string; role: string } };

  const { data, isLoading, isError, error } = useReport(id);
  const { mutate } = useUpdateReport();

  // フォーム値の状態管理。
  const [title, setTitle] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const report = data?.data;

  // マウント時にグローバルトーストコンテナ内の残留トーストをクリーンアップする。
  // 前のページ遷移で表示されたトーストが残っていた場合に備える。
  // document.body 全体ではなく専用コンテナだけを対象にすることで
  // React がレンダリングした toast 要素を誤って削除しない。
  useEffect(() => {
    clearGlobalToasts();
  }, []);

  // レポートデータが取得されたらフォームを初期化する。
  useEffect(() => {
    if (report && !initialized) {
      setTitle(report.title);
      setPeriodStart(report.period_start);
      setPeriodEnd(report.period_end);
      setInitialized(true);
    }
  }, [report, initialized]);

  // 404 エラー時: グローバルトーストを表示して一覧にリダイレクトする。
  useEffect(() => {
    if (!isError) return;
    const apiErr = error as (Error & { status?: number; code?: string }) | null;
    if (apiErr?.status === 404 || apiErr?.code === 'RESOURCE_NOT_FOUND') {
      // グローバルトーストを表示してからナビゲートする（ページ遷移後もトーストが残る）。
      showGlobalToast('指定されたデータが見つかりません。', 'error');
      navigate('/reports');
    }
  }, [isError, error, navigate]);

  // draft でない場合: グローバルトーストを表示して詳細画面にリダイレクトする。
  useEffect(() => {
    if (!report) return;
    // 所有者チェック: 所有者でない場合はトーストのみ表示（リダイレクトなし）。
    if (authResult.user && report.submitter?.id !== authResult.user.id) return;
    if (report.status !== 'draft') {
      // グローバルトーストを表示してからナビゲートする（ページ遷移後もトーストが残る）。
      showGlobalToast('提出済みのレポートは編集できません', 'warning');
      navigate(`/reports/${report.id}`);
    }
  }, [report, authResult.user, navigate]);

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return <div data-testid="page-skeleton" data-variant="form" />;
  }

  // 404 エラー後のリダイレクト待ち（useEffect でナビゲート中）はローディングと同様に null を返す。
  if (isError) {
    const apiErr = error as (Error & { status?: number; code?: string }) | null;
    if (apiErr?.status === 404 || apiErr?.code === 'RESOURCE_NOT_FOUND') {
      return null;
    }
  }

  if (!report) {
    return null;
  }

  // 所有者でない場合はトーストを表示する（リダイレクトはしない）。
  if (authResult.user && report.submitter?.id !== authResult.user.id) {
    return (
      <div data-testid="app-toast" data-severity="error">
        この操作を行う権限がありません。
      </div>
    );
  }

  // draft でない場合はリダイレクト待ち（useEffect でナビゲート中）は null を返す。
  if (report.status !== 'draft') {
    return null;
  }

  // フォーム送信処理。
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    mutate(
      {
        id: report.id,
        title,
        period_start: periodStart,
        period_end: periodEnd,
        updated_at: report.updated_at,
      },
      {
        onSuccess: () => {
          navigate(`/reports/${report.id}`);
        },
        onError: (err) => {
          const apiErr = err as (Error & { status?: number; code?: string });
          if (apiErr?.status === 409 || apiErr?.code === 'CONFLICT') {
            setApiError('他のユーザーがこのレポートを更新しました。ページを再読み込みしてください。');
          } else {
            setApiError(err instanceof Error ? err.message : 'エラーが発生しました');
          }
        },
      },
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      {/* エラーアラート */}
      {apiError !== null && (
        <div data-testid="form-alert" role="alert">
          {apiError}
        </div>
      )}

      {/* タイトル入力 */}
      <TextField
        label="タイトル"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      {/* 期間開始日 */}
      <input
        name="periodStart"
        type="date"
        value={periodStart}
        onChange={(e) => setPeriodStart(e.target.value)}
        aria-label="開始日"
        style={{ display: 'block', marginBottom: 16 }}
      />

      {/* 期間終了日 */}
      <input
        name="periodEnd"
        type="date"
        value={periodEnd}
        onChange={(e) => setPeriodEnd(e.target.value)}
        aria-label="終了日"
        style={{ display: 'block', marginBottom: 16 }}
      />

      {/* アクションボタン */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          type="button"
          variant="outlined"
          onClick={() => navigate(`/reports/${report.id}`)}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          variant="contained"
        >
          保存する
        </Button>
      </Box>
    </Box>
  );
}
