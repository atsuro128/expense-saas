// 認証済み画面の共通レイアウトコンポーネント。
// AppHeader + AppSidebar + メインコンテンツ領域を統合する。
// screens.md §4.1 準拠。メインコンテンツ領域は Container maxWidth="lg" で制約する。

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import PageSkeleton from '../ui/PageSkeleton';
import { clearTokens } from '../../stores/auth';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import type { HeaderUser } from './AppHeader';

export interface AppLayoutProps {
  /** メインコンテンツ領域に描画する子要素 */
  children: React.ReactNode;
}

/** サイドバーの幅（AppHeader・AppSidebar と統一） */
const DRAWER_WIDTH = 240;

/**
 * AppLayout は認証済み画面の共通レイアウトを提供する。
 * AppHeader と AppSidebar を内部で統合し、メインコンテンツを描画する。
 * useCurrentUser で GET /api/auth/me を取得し、ローディング中はスケルトンを表示する。
 */
export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // TanStack Query でユーザー情報を取得する。
  const { data: currentUserResponse, isLoading } = useCurrentUser();

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    clearTokens();
    // ログアウト後にキャッシュされたユーザー情報が残らないようクエリキャッシュを破棄する。
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    navigate('/login');
  };

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return <PageSkeleton variant="card" />;
  }

  // ユーザー情報が取得できない場合はログイン画面にリダイレクトする。
  const authUser = currentUserResponse?.data;
  if (!authUser) {
    navigate('/login');
    return null;
  }

  const user: HeaderUser = { name: authUser.name, role: authUser.role };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* ヘッダー */}
      <AppHeader
        user={user}
        onToggleSidebar={handleToggleSidebar}
        onLogout={handleLogout}
      />

      {/* サイドバー */}
      <AppSidebar
        role={user.role}
        currentPath={location.pathname}
        open={sidebarOpen}
        onClose={handleCloseSidebar}
      />

      {/* メインコンテンツ */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        {/* AppBar 分の余白 */}
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
