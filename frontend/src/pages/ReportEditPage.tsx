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
  const [toastMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const report = data?.data;

  // レポートデータが取得されたらフォームを初期化する。
  useEffect(() => {
    if (report && !initialized) {
      setTitle(report.title);
      setPeriodStart(report.period_start);
      setPeriodEnd(report.period_end);
      setInitialized(true);
    }
  }, [report, initialized]);

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return <div data-testid="page-skeleton" data-variant="form" />;
  }

  // 404 エラー時は一覧にリダイレクトしてトーストを表示する。
  if (isError) {
    const apiErr = error as (Error & { status?: number; code?: string }) | null;
    if (apiErr?.status === 404 || apiErr?.code === 'RESOURCE_NOT_FOUND') {
      return (
        <Box>
          <div data-testid="app-toast" data-severity="error">
            {apiErr instanceof Error ? apiErr.message : 'レポートが見つかりませんでした'}
          </div>
          {/* 404 時は /reports にリダイレクト（useEffect で navigate を呼ぶ）。 */}
          <RedirectOnMount to="/reports" onNavigate={navigate} />
        </Box>
      );
    }
  }

  if (!report) {
    return null;
  }

  // 所有者でない場合はトーストを表示する。
  if (authResult.user && report.submitter?.id !== authResult.user.id) {
    return (
      <div data-testid="app-toast" data-severity="error">
        このレポートを編集する権限がありません
      </div>
    );
  }

  // draft でない場合は詳細画面にリダイレクトしてトーストを表示する。
  if (report.status !== 'draft') {
    return (
      <Box>
        <div data-testid="app-toast" data-severity="warning">
          このレポートは編集できません
        </div>
        <RedirectOnMount to={`/reports/${report.id}`} onNavigate={navigate} />
      </Box>
    );
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
      {/* トースト通知 */}
      {toastMessage !== null && (
        <div data-testid="app-toast" data-severity="error">
          {toastMessage}
        </div>
      )}

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

// マウント直後に navigate を呼ぶヘルパーコンポーネント。
function RedirectOnMount({ to, onNavigate }: { to: string; onNavigate: (path: string) => void }) {
  useEffect(() => {
    onNavigate(to);
  }, [to, onNavigate]);
  return null;
}
