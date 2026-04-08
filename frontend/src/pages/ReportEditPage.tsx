// レポート編集ページ。
// RPT-FE-050〜057 の仕様に対応する。
// 既存レポートデータをフォームにプリフィルし、更新処理を管理する。

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ReportForm from '../components/report/ReportForm';
import type { ReportFormValues } from '../components/report/ReportForm';
import PageSkeleton from '../components/ui/PageSkeleton';
import { useReport, useUpdateReport } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';

/**
 * BodyToast はページコンポーネントのライフサイクルに依存せず
 * document.body にトーストを表示するコンポーネント。
 * useEffect でクリーンアップを行わないため、navigate によるアンマウント後も DOM に残る。
 */
function BodyToast({ message, severity }: { message: string; severity: 'error' | 'success' | 'warning' | 'info' }) {
  useEffect(() => {
    // toast 要素を document.body に直接追加する。
    const container = document.createElement('div');
    const toastEl = document.createElement('div');
    toastEl.setAttribute('data-testid', 'app-toast');
    toastEl.setAttribute('data-severity', severity);
    toastEl.setAttribute('role', 'alert');
    toastEl.textContent = message;
    container.appendChild(toastEl);
    document.body.appendChild(container);

    // クリーンアップしない（navigate 後もトーストを DOM に残すため）。
  }, [message, severity]);

  return null;
}

/**
 * ReportEditPage は既存レポートの編集フォームを表示する画面。
 * 404 の場合は /reports にリダイレクト、非所有者の場合は 403 トーストを表示、
 * draft 以外の場合は /reports/:id にリダイレクトする。
 * 成功時は /reports/:id に遷移する。
 */
export default function ReportEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 現在のユーザー情報を取得する。
  const { user } = useAuth();

  // API エラーメッセージ状態（409 Conflict 等）。
  const [apiError, setApiError] = useState<string | null>(null);

  // ページレベルのトースト状態（リダイレクト時も DOM に残す）。
  const [bodyToast, setBodyToast] = useState<{ message: string; severity: 'error' } | null>(null);

  // レポートデータを取得する。
  const { data, isLoading, isError, error } = useReport(id);
  const report = data?.data;

  // 404 エラー → /reports にリダイレクト。
  useEffect(() => {
    if (isError && error) {
      setBodyToast({ message: '指定されたデータが見つかりません。', severity: 'error' });
      navigate('/reports');
    }
  }, [isError, error, navigate]);

  // 所有者チェック: 非所有者の場合はトーストを表示する。
  useEffect(() => {
    if (report && user && report.submitter.id !== user.id) {
      setBodyToast({ message: 'この操作を行う権限がありません。', severity: 'error' });
    }
  }, [report, user]);

  // draft 以外チェック: draft でない場合は /reports/:id にリダイレクト。
  useEffect(() => {
    if (report && report.status !== 'draft') {
      setBodyToast({ message: '提出済みのレポートは編集できません', severity: 'error' });
      navigate(`/reports/${id}`);
    }
  }, [report, id, navigate]);

  // レポート更新ミューテーション。
  const { mutate, isPending } = useUpdateReport();

  /**
   * フォーム送信ハンドラ。成功時は /reports/:id に遷移する。
   */
  const handleSubmit = (data: ReportFormValues) => {
    if (!report) return;
    setApiError(null);
    mutate(
      {
        id: report.id,
        title: data.title,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        updated_at: report.updated_at,
      },
      {
        onSuccess: () => {
          navigate(`/reports/${id}`);
        },
        onError: (err: Error & { status?: number; code?: string }) => {
          if (err.status === 409) {
            setApiError('他のユーザーがこのレポートを更新しました。ページを再読み込みしてください。');
          } else {
            setApiError(err.message);
          }
        },
      },
    );
  };

  /**
   * キャンセルボタン押下時は /reports/:id に遷移する。
   */
  const handleCancel = () => {
    navigate(`/reports/${id}`);
  };

  return (
    <Box>
      {/* ページレベルトースト（リダイレクト後も DOM に残る） */}
      {bodyToast && (
        <BodyToast message={bodyToast.message} severity={bodyToast.severity} />
      )}

      {/* ローディング中はスケルトン表示 */}
      {isLoading && <PageSkeleton variant="form" />}

      {/* レポートデータが取得できた場合にフォームを表示 */}
      {!isLoading && !isError && report && report.status === 'draft' && report.submitter.id === user?.id && (
        <>
          <Typography variant="h5" sx={{ mb: 3 }}>
            レポート編集
          </Typography>
          <ReportForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            apiError={apiError}
            isPending={isPending}
            submitLabel="保存する"
            defaultValues={{
              title: report.title,
              periodStart: report.period_start,
              periodEnd: report.period_end,
            }}
          />
        </>
      )}
    </Box>
  );
}
