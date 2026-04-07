// TenantPage: テナント情報画面（SCR-ADM-002）
// Admin ロールのみアクセス可能。他ロールはダッシュボード（/）にリダイレクトする。
// 403 エラー時もダッシュボードにリダイレクトする。
// 500 系エラーは SnackbarContext を通じてトーストで通知する。

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../hooks/useTenant';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ApiClientError } from '../../api/client';
import AppLayout from '../../components/layout/AppLayout';
import PageTitle from '../../components/ui/PageTitle';
import AppToast from '../../components/ui/AppToast';
import TenantInfoCard from './TenantInfoCard';
import PhaseNotice from './PhaseNotice';

/**
 * TenantPage はテナント情報画面のページコンポーネント。
 * Admin ロールのみ利用可能。他ロールや 403 エラー時はダッシュボードにリダイレクトする。
 */
export default function TenantPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading, error } = useTenant();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Admin 以外のロールはダッシュボードにリダイレクトする。
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  // 403 エラー時はダッシュボードにリダイレクトする。
  useEffect(() => {
    if (error instanceof ApiClientError && error.status === 403) {
      navigate('/');
    }
  }, [error, navigate]);

  // 500 系エラーはトーストで通知する。
  useEffect(() => {
    if (error instanceof ApiClientError && error.status >= 500) {
      setToastMessage('サーバーエラーが発生しました');
      setToastOpen(true);
    }
  }, [error]);

  const tenantData = data?.data;
  const apiError = error instanceof ApiClientError ? error : null;

  return (
    <AppLayout>
      <PageTitle title="テナント情報" />
      <TenantInfoCard
        tenant={tenantData}
        loading={isLoading}
        error={apiError}
      />
      <PhaseNotice message="テナント情報の編集機能は今後追加予定です。" />
      <AppToast
        open={toastOpen}
        severity="error"
        message={toastMessage}
        onClose={() => setToastOpen(false)}
      />
    </AppLayout>
  );
}
