// フォーム送信ボタン。送信中は disabled + スピナー表示。
// 認証画面・業務画面で共通利用する。

export interface SubmitButtonProps {
  /** ボタンに表示するラベルテキスト。 */
  label: string;
  /** 送信処理中フラグ。true のとき disabled + スピナーを表示する。 */
  loading: boolean;
}

/**
 * SubmitButton はフォーム送信ボタンコンポーネント。
 * loading=true のとき disabled 状態でスピナーを表示する。
 */
export default function SubmitButton({ label, loading }: SubmitButtonProps) {
  // 未実装スタブ。実装後に MUI Button + CircularProgress を使用する。
  return (
    <button type="submit" disabled={loading} aria-busy={loading}>
      {loading ? <span data-testid="spinner" /> : null}
      {label}
    </button>
  );
}
