// 認証ガードコンポーネント。
// 未ログイン時は /login にリダイレクトし、元の URL を location.state.from に保持する。
// SMK-008 の return_to 要件に対応する。
// ロール不一致の制御は各ページコンポーネント側（TenantPage / AllReportsPage 等）が担う。

import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { getAccessToken } from '../../stores/auth';

/**
 * PrivateRoute は認証必須ルートのガードコンポーネント。
 * アクセストークンが存在しない場合は /login にリダイレクトし、
 * location.state.from に元の URL を保持してログイン後の復帰を可能にする。
 */
export default function PrivateRoute() {
  const location = useLocation();
  const isAuthenticated = getAccessToken() !== null;

  if (!isAuthenticated) {
    // 未ログイン時は /login にリダイレクトし、元の URL を state.from に保持する。
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <Outlet />;
}
