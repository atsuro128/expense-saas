// PhaseNotice: Phase 3 予告メッセージをグレーの補足文として表示するコンポーネント。
// MVP では編集機能がないことをユーザーに伝える。

/** PhaseNotice コンポーネントの Props。 */
interface PhaseNoticeProps {
  /** 予告メッセージテキスト */
  message: string;
}

/**
 * PhaseNotice は Phase 3 予告メッセージを表示するコンポーネント。
 */
export default function PhaseNotice({ message }: PhaseNoticeProps) {
  return (
    <p data-testid="phase-notice" style={{ color: 'gray' }}>
      {message}
    </p>
  );
}
