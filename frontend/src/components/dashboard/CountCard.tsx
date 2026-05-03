// ダッシュボード用カウントカードコンポーネント。
// 件数を大きなフォントで表示する。ラベル・件数・リンク先を受け取り、
// カードクリックで指定画面に遷移する。
// 55_ui_component/screens/dashboard.md §CountCard 準拠。

import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

export interface CountCardProps {
  /** カードのラベル（例: 「下書き」「承認待ち」） */
  label: string;
  /** 表示する件数 */
  count: number;
  /** カードクリック時の遷移先パス。未指定の場合はクリック不可 */
  href?: string;
  /** アクセントカラー */
  accentColor?: 'default' | 'info' | 'success' | 'error' | 'secondary';
  /** 件数の単位（デフォルト: 「件」） */
  unit?: string;
}

/**
 * CountCard はダッシュボードの件数カードを表示するコンポーネント。
 */
export default function CountCard({
  label,
  count,
  href,
  accentColor = 'default',
  unit = '件',
}: CountCardProps) {
  const cardContent = (
    <Card
      sx={{
        cursor: href ? 'pointer' : 'default',
        // borderTop を常時確保することで default カードと色付きカードの高さを揃える（issue #168）。
        // default 時は transparent にすることで見た目上は「ボーダーなし」を維持する。
        borderTop: '3px solid',
        borderColor: accentColor !== 'default' ? `${accentColor}.main` : 'transparent',
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 1 }}>
          <Typography variant="h4" component="span" fontWeight="bold">
            {count}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unit}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link to={href} style={{ textDecoration: 'none', display: 'block' }}>
        {cardContent}
      </Link>
    );
  }

  return <>{cardContent}</>;
}
