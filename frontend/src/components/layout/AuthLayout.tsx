// 認証画面（ログイン・サインアップ・パスワードリセット）共通のレイアウトコンポーネント。
// 認証済みの場合はダッシュボードへリダイレクトする。
// screens.md §4.1 準拠。ヘッダー・サイドナビゲーションを表示しない。

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { useAuth } from '../../hooks/useAuth';

export interface AuthLayoutProps {
  /** フォームカード内に描画する子要素 */
  children: ReactNode;
}

/**
 * AuthLayout は認証画面のラッパーコンポーネント。
 * 認証済みユーザーはダッシュボードにリダイレクトする。
 * 未認証ユーザーには画面中央にフォームカードを表示する。
 * AppToast を使用しない（認証画面では FormAlert を使用する）。
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box
      data-testid="auth-layout"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
      }}
    >
      <Container maxWidth="sm">
        {children}
      </Container>
    </Box>
  );
}
