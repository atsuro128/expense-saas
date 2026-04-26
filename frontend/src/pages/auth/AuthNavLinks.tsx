// 認証画面下部のナビゲーションリンクを表示するコンポーネント。
// ログイン・サインアップ・パスワードリセット画面で共有される。
// 認証画面専用のため pages/auth/ に配置する。

import Box from '@mui/material/Box';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

/** ナビゲーションリンクの定義。 */
export interface AuthNavLink {
  /**
   * リンクの前に表示するテキスト（例: "アカウントをお持ちでない方は"）。
   * 省略した場合は label のみを表示する（例: "ログイン画面に戻る"）。
   */
  prefix?: string;
  /** リンクテキスト（例: "新規登録"）。 */
  label: string;
  /** リンク先のパス（例: "/signup"）。 */
  to: string;
}

export interface AuthNavLinksProps {
  /** 表示するナビゲーションリンクの配列。 */
  links: AuthNavLink[];
}

/**
 * AuthNavLinks は認証画面下部のナビゲーションリンクを描画する。
 * 各リンクは prefix テキストとリンクテキストのペアで構成される。
 */
export default function AuthNavLinks({ links }: AuthNavLinksProps) {
  return (
    <Box
      component="nav"
      data-testid="auth-nav-links"
      sx={{ mt: 2, textAlign: 'center' }}
    >
      {links.map((link) => (
        <Typography key={link.to} variant="body2" sx={{ mb: 1 }}>
          {/* prefix が truthy のときのみ prefix テキストを描画する（空文字も非表示）。 */}
          {link.prefix && link.prefix}
          <MuiLink component={RouterLink} to={link.to} underline="hover">
            {link.label}
          </MuiLink>
        </Typography>
      ))}
    </Box>
  );
}
