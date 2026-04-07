// ページタイトルコンポーネント。
// Typography h5 でページタイトルを統一表示する。

import Typography from '@mui/material/Typography';

export interface PageTitleProps {
  /** ページタイトルテキスト */
  title: string;
}

/**
 * PageTitle はページタイトルを Typography で統一表示する。
 */
export default function PageTitle({ title }: PageTitleProps) {
  return (
    <Typography variant="h5" component="h1" gutterBottom>
      {title}
    </Typography>
  );
}
