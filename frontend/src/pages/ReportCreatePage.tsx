// レポート作成ページ。
// report-create.md §ReportCreatePage 準拠の最小構造。
// Step 10 で本実装に置き換える。

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useCreateReport, useReport } from '../hooks/useReports';

/**
 * ReportCreatePage はレポート作成画面のルートコンポーネント。
 * URL パラメータ ?ref=:id がある場合は元レポートデータをプリフィルする。
 */
export default function ReportCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ?ref パラメータから元レポート ID を取得する。
  const refId = searchParams.get('ref') ?? undefined;

  // 元レポートデータの取得（ref パラメータが存在する場合）。
  const { data: refReportData } = useReport(refId);
  const refReport = refReportData?.data;

  // フォーム値の状態管理（プリフィルを初期値として設定）。
  const [title, setTitle] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const { mutate } = useCreateReport();

  // 表示値: ローカル状態 → プリフィル値の優先順位。
  const displayTitle = title !== '' ? title : (refReport?.title ?? '');
  const displayPeriodStart = periodStart !== '' ? periodStart : (refReport?.period_start ?? '');
  const displayPeriodEnd = periodEnd !== '' ? periodEnd : (refReport?.period_end ?? '');

  // フォーム送信処理。
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    mutate(
      {
        title: displayTitle,
        period_start: displayPeriodStart,
        period_end: displayPeriodEnd,
        reference_report_id: refId,
      },
      {
        onSuccess: (result) => {
          navigate(`/reports/${result.id}`);
        },
        onError: (err) => {
          setApiError(err instanceof Error ? err.message : 'エラーが発生しました');
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
        value={displayTitle}
        onChange={(e) => setTitle(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      {/* 期間開始日 */}
      <input
        name="periodStart"
        type="date"
        value={displayPeriodStart}
        onChange={(e) => setPeriodStart(e.target.value)}
        aria-label="開始日"
        style={{ display: 'block', marginBottom: 16 }}
      />

      {/* 期間終了日 */}
      <input
        name="periodEnd"
        type="date"
        value={displayPeriodEnd}
        onChange={(e) => setPeriodEnd(e.target.value)}
        aria-label="終了日"
        style={{ display: 'block', marginBottom: 16 }}
      />

      {/* アクションボタン */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          type="button"
          variant="outlined"
          onClick={() => navigate('/reports')}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          variant="contained"
        >
          作成する
        </Button>
      </Box>
    </Box>
  );
}
