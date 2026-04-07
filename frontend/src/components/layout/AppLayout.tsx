// 認証済み画面の共通レイアウトコンポーネント。
// AppHeader + AppSidebar + メインコンテンツ領域を統合する。
// screens.md §4.1 準拠。メインコンテンツ領域は Container maxWidth="lg" で制約する。

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import { clearTokens, getAccessToken } from '../../stores/auth';
import type { HeaderUser } from './AppHeader';

export interface AppLayoutProps {
  /** メインコンテンツ領域に描画する子要素 */
  children: React.ReactNode;
}

/** サイドバーの幅（AppHeader・AppSidebar と統一） */
const DRAWER_WIDTH = 240;

/**
 * JWT ペイロードからロールを取得する（署名検証なし、表示用途のみ）。
 * access token の claims は sub, tenant_id, role, token_type のみ。
 * name は含まれないため、Step 10 で /api/auth/me レスポンスから取得する。
 */
function decodeUserFromToken(): HeaderUser | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payload = JSON.parse(atob(payloadBase64)) as Record<string, unknown>;
    const role = payload['role'];
    if (
      role === 'admin' ||
      role === 'approver' ||
      role === 'member' ||
      role === 'accounting'
    ) {
      // name は access token に含まれない。Step 10 で認証コンテキスト経由に切り替える。
      return { name: '', role };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * AppLayout は認証済み画面の共通レイアウトを提供する。
 * AppHeader と AppSidebar を内部で統合し、メインコンテンツを描画する。
 */
export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // JWT からユーザー情報を取得（Step 10 で認証コンテキストに切り替え）
  const user = decodeUserFromToken();

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    clearTokens();
    navigate('/login');
  };

  // トークンが無い場合はログイン画面に遷移
  if (!user) {
    navigate('/login');
    return null;
  }

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
