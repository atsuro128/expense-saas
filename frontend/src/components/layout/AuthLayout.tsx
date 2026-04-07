// 認証画面（ログイン・サインアップ・パスワードリセット）共通のレイアウトコンポーネント。
// 認証済みの場合はダッシュボードへリダイレクトする。

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export interface AuthLayoutProps {
  /** 内部に表示するコンテンツ。 */
  children: ReactNode;
}

/**
 * AuthLayout は認証画面のラッパーコンポーネント。
 * 認証済みユーザーはダッシュボードにリダイレクトする。
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  // 未実装スタブ。実装後に MUI コンテナ等を使用する。
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <div data-testid="auth-layout">{children}</div>;
}
