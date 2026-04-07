// パンくずナビゲーションコンポーネント。
// ui-guidelines.md §4 に従い MUI Breadcrumbs を使用する。

import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

/** パンくずアイテムの定義 */
export interface BreadcrumbItem {
  /** パンくずのテキスト */
  label: string;
  /** 遷移先パス（最後の要素は現在のページのため href なし） */
  href?: string;
}

export interface AppBreadcrumbsProps {
  /** パンくずアイテムの配列（先頭がルート、末尾が現在のページ） */
  items: BreadcrumbItem[];
}

/**
 * AppBreadcrumbs はページのパンくずナビゲーションを統一表示する。
 * 最後の要素はリンクなしのテキストとして表示する。
 */
export default function AppBreadcrumbs({ items }: AppBreadcrumbsProps) {
  return (
    <Breadcrumbs aria-label="パンくずナビゲーション" sx={{ mb: 2 }}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (isLast || !item.href) {
          // 現在のページは非リンク
          return (
            <Typography key={item.label} color="text.primary" variant="body2">
              {item.label}
            </Typography>
          );
        }

        return (
          <Link
            key={item.label}
            component={RouterLink}
            to={item.href}
            underline="hover"
            color="inherit"
            variant="body2"
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
