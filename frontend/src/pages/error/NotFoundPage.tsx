// 404 ページコンポーネント。
// 定義されていない URL にアクセスした場合に表示される共通エラー画面。
// PrivateRoute 内に配置するため、ログイン済みユーザーのみが閲覧できる。
// AppLayout（サイドバー・ヘッダー）の中で表示されるため、ナビゲーションが利用可能。

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

/** 404 ページ。未定義 URL に対する共通エラー画面。 */
export default function NotFoundPage() {
  return (
    <Box
      data-testid="not-found-page"
      sx={{ textAlign: 'center', py: 8 }}
    >
      <Typography variant="h4" component="h1">
        お探しのページが見つかりません
      </Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        URL が間違っているか、ページが移動された可能性があります。
      </Typography>
      <Box sx={{ mt: 4 }}>
        <Link
          data-testid="not-found-dashboard-link"
          to="/dashboard"
        >
          ダッシュボードへ戻る
        </Link>
      </Box>
    </Box>
  );
}
