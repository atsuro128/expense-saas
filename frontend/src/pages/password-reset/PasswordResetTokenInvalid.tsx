// パスワードリセットトークン無効コンポーネント。
// トークンが無効または期限切れの場合に表示する。
// パスワードリセット要求画面へのリンクを含む。

import { Link } from 'react-router-dom';

/**
 * PasswordResetTokenInvalid はトークン無効・期限切れ画面を描画する。
 * パスワードリセット要求画面へのリンクを含む。
 * 未実装スタブ。
 */
export default function PasswordResetTokenInvalid() {
  return (
    <div data-testid="password-reset-token-invalid">
      <p>リセットリンクが無効または期限切れです。再度パスワードリセットを申請してください。</p>
      <Link to="/password-reset">パスワードリセット画面へ</Link>
    </div>
  );
}
