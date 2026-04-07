// パスワードリセット要求完了コンポーネント。
// SEC-011 準拠: ユーザーの存在に関わらず同一のメッセージを表示する。

/**
 * PasswordResetRequestComplete はパスワードリセットメール送信完了画面を描画する。
 * 送信完了メッセージと迷惑メールフォルダの注意書きを表示する。
 * 未実装スタブ。
 */
export default function PasswordResetRequestComplete() {
  return (
    <div data-testid="password-reset-request-complete">
      <p>パスワードリセット用のメールを送信しました。メールに記載されたリンクからパスワードを再設定してください。</p>
      <p>メールが届かない場合は、迷惑メールフォルダをご確認ください。</p>
    </div>
  );
}
