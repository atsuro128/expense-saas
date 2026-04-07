// TenantInfoCard: テナント情報を Card コンポーネントで表示するコンポーネント。
// ローディング中は PageSkeleton を表示し、データ取得後は TenantInfoField で会社名を表示する。
// 404 エラー時はエラーメッセージを表示する。

import type { TenantInfo } from '../../api/types';
import type { ApiClientError } from '../../api/client';
import TenantInfoField from './TenantInfoField';

/** TenantInfoCard コンポーネントの Props。 */
interface TenantInfoCardProps {
  /** テナント情報 */
  tenant: TenantInfo | undefined;
  /** ローディング状態 */
  loading: boolean;
  /** エラー状態（404 等） */
  error: ApiClientError | null;
}

/**
 * TenantInfoCard はテナント情報を Card で表示するコンポーネント。
 * loading 中は PageSkeleton（variant="card"）を表示する。
 * 404 エラー時は「テナント情報が見つかりません。」を表示する。
 */
export default function TenantInfoCard({ tenant, loading, error }: TenantInfoCardProps) {
  if (loading) {
    // ローディング中は PageSkeleton を表示する（variant="card"）。
    return <div data-testid="page-skeleton-card" aria-label="読み込み中" />;
  }

  if (error) {
    if (error.status === 404) {
      return <p>テナント情報が見つかりません。</p>;
    }
    return null;
  }

  if (!tenant) {
    return null;
  }

  return (
    <div>
      <TenantInfoField label="会社名" value={tenant.name} />
    </div>
  );
}
