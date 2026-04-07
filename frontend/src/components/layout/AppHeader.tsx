// 認証済み画面のヘッダーコンポーネント。
// アプリロゴ・ユーザーメニュー（ユーザー名・ロール名・ログアウト）・Drawer 開閉トリガーを統合する。
// screens.md §4.2 準拠。

import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { Link as RouterLink } from 'react-router-dom';

/** ユーザー情報（openapi.yaml UserProfile に準拠） */
export interface HeaderUser {
  /** ユーザー名 */
  name: string;
  /** テナント内ロール */
  role: 'admin' | 'approver' | 'member' | 'accounting';
}

export interface AppHeaderProps {
  /** 現在のログインユーザー情報 */
  user: HeaderUser;
  /** サイドバー開閉コールバック（md 未満のレスポンシブ対応） */
  onToggleSidebar: () => void;
  /** ログアウトコールバック */
  onLogout: () => void;
}

/** ロール名の日本語表示マッピング */
const roleLabels: Record<HeaderUser['role'], string> = {
  admin: '管理者',
  approver: '承認者',
  member: 'メンバー',
  accounting: '経理',
};

/** サイドバーの幅（AppSidebar と統一） */
const DRAWER_WIDTH = 240;

/**
 * AppHeader は認証済み画面の上部ヘッダーを描画する。
 * md 未満の画面幅ではハンバーガーメニューを表示する。
 */
export default function AppHeader({ user, onToggleSidebar, onLogout }: AppHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleCloseMenu();
    onLogout();
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        // md 以上ではサイドバー幅分だけ右にずらす
        width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { md: `${DRAWER_WIDTH}px` },
      }}
    >
      <Toolbar>
        {/* md 未満のみハンバーガーメニューを表示 */}
        <Tooltip title="メニューを開く">
          <IconButton
            color="inherit"
            aria-label="メニューを開く"
            edge="start"
            onClick={onToggleSidebar}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>

        {/* アプリロゴ（クリックでダッシュボードに遷移: screens.md §4.2） */}
        <Typography
          variant="h6"
          component={RouterLink}
          to="/dashboard"
          sx={{
            flexGrow: 1,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          経費精算
        </Typography>

        {/* ユーザーメニュー */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {user.name}（{roleLabels[user.role]}）
          </Typography>
          <Tooltip title="ユーザーメニュー">
            <IconButton
              color="inherit"
              aria-label="ユーザーメニュー"
              onClick={handleOpenMenu}
              aria-controls={anchorEl ? 'user-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={anchorEl ? 'true' : undefined}
            >
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Menu
          id="user-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem disabled>
            <Typography variant="body2">
              {user.name}（{roleLabels[user.role]}）
            </Typography>
          </MenuItem>
          <MenuItem onClick={handleLogout}>ログアウト</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
