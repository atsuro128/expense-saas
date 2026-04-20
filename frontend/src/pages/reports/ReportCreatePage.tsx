// レポート作成ページ。
// RPT-FE-024〜027 の仕様に対応する。
// ?ref=:id がある場合は元レポートデータをプリフィルする。

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ReportForm from '../../components/report/ReportForm';
import type { ReportFormValues } from '../../components/report/ReportForm';
import { useCreateReport, useReport } from '../../hooks/useReports';

/**
 * ReportCreatePage は新規レポート作成フォームを表示する画面。
 * ?ref=:id パラメータがある場合は元レポートのデータをフォームにプリフィルする。
 * 成功時は /reports/:id に遷移する。
 */
export default function ReportCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ?ref クエリパラメータから元レポート ID を取得する。
  const refId = searchParams.get('ref') ?? undefined;

  // API エラーメッセージ状態。
  const [apiError, setApiError] = useState<string | null>(null);

  // 元レポートデータを取得する（?ref がある場合のみ）。
  const { data: refData } = useReport(refId);

  // 元レポートデータからフォーム初期値を生成する。
  const [defaultValues, setDefaultValues] = useState<ReportFormValues | undefined>(undefined);

  useEffect(() => {
    if (refData?.data) {
      setDefaultValues({
        title: refData.data.title,
        periodStart: refData.data.period_start,
        periodEnd: refData.data.period_end,
      });
    }
  }, [refData]);

  // レポート作成ミューテーション。
  const { mutate, isPending } = useCreateReport();

  /**
   * フォーム送信ハンドラ。成功時は /reports/:id に遷移する。
   */
  const handleSubmit = (data: ReportFormValues) => {
    setApiError(null);
    mutate(
      {
        title: data.title,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        reference_report_id: refId,
      },
      {
        onSuccess: (result) => {
          // 成功トーストを遷移先の ReportDetailPage に location.state 経由で渡す。
          // navigate 直後にアンマウントされるため、ページ側でトーストを表示する設計（ReportListPage パターン準拠）。
          navigate(`/reports/${result.id}`, {
            state: { toast: { severity: 'success', message: 'レポートを作成しました' } },
          });
        },
        onError: (err) => {
          setApiError(err.message);
        },
      },
    );
  };

  /**
   * キャンセルボタン押下時は /reports に遷移する。
   */
  const handleCancel = () => {
    navigate('/reports');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        レポート作成
      </Typography>
      <ReportForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        apiError={apiError}
        isPending={isPending}
        submitLabel="作成する"
        defaultValues={defaultValues}
      />
    </Box>
  );
}
