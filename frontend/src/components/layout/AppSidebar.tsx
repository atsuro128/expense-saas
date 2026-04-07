// 認証済み画面のサイドナビゲーションコンポーネント。
// ナビゲーションメニュー項目のロール別表示制御とアクティブ状態ハイライトを統合する。
// screens.md §4.3 準拠。
// md 以上: permanent（常時表示）、md 未満: temporary（ハンバーガーメニュー開閉）。

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import { Link as RouterLink } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentIcon from '@mui/icons-material/Payment';
import FolderIcon from '@mui/icons-material/Folder';
import BusinessIcon from '@mui/icons-material/Business';

export interface AppSidebarProps {
  /** 現在のユーザーロール（メニュー項目の表示制御に使用） */
  role: 'admin' | 'approver' | 'member' | 'accounting';
  /** 現在の URL パス（アクティブ状態ハイライトに使用） */
  currentPath: string;
  /** サイドバーの開閉状態（md 未満で使用） */
  open: boolean;
  /** サイドバー閉じるコールバック（md 未満で使用） */
  onClose: () => void;
}

/** サイドバーの幅（AppHeader と統一） */
const DRAWER_WIDTH = 240;

/** ナビゲーション項目の定義 */
interface NavItem {
  /** メニューラベル */
  label: string;
  /** 遷移先パス */
  path: string;
  /** MUI アイコンコンポーネント */
  icon: React.ReactNode;
  /** 表示対象ロール一覧 */
  roles: Array<'admin' | 'approver' | 'member' | 'accounting'>;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'ダッシュボード',
    path: '/dashboard',
    icon: <DashboardIcon />,
    roles: ['admin', 'approver', 'member', 'accounting'],
  },
  {
    label: 'マイレポート',
    path: '/reports',
    icon: <ReceiptIcon />,
    roles: ['admin', 'approver', 'member', 'accounting'],
  },
  {
    label: 'レポート作成',
    path: '/reports/new',
    icon: <AddIcon />,
    roles: ['admin', 'approver', 'member', 'accounting'],
  },
  {
    label: '承認待ち',
    path: '/approvals',
    icon: <CheckCircleIcon />,
    roles: ['approver'],
  },
  {
    label: '支払待ち',
    path: '/payments',
    icon: <PaymentIcon />,
    roles: ['accounting'],
  },
  {
    label: '全レポート',
    path: '/admin/reports',
    icon: <FolderIcon />,
    roles: ['accounting', 'admin'],
  },
  {
    label: 'テナント情報',
    path: '/settings/tenant',
    icon: <BusinessIcon />,
    roles: ['admin'],
  },
];

/**
 * AppSidebar は認証済み画面のサイドナビゲーションを描画する。
 * md 以上では permanent Drawer、md 未満では temporary Drawer を使用する。
 * ロールに基づいてメニュー項目を表示制御する。
 */
export default function AppSidebar({ role, currentPath, open, onClose }: AppSidebarProps) {
  // ロールに応じてフィルタリングしたナビゲーション項目
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const drawerContent = (
    <>
      {/* AppBar 分の余白を確保 */}
      <Toolbar />
      <List>
        {visibleItems.map((item) => {
          // アクティブ判定: ダッシュボードは完全一致、その他はパスの前方一致
          const isActive =
            item.path === '/dashboard'
              ? currentPath === '/dashboard'
              : currentPath.startsWith(item.path);

          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                selected={isActive}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      {/* md 未満: temporary Drawer（ハンバーガーメニューで開閉） */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* md 以上: permanent Drawer（常時表示） */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
