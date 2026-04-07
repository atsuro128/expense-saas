// トースト通知コンポーネント。
// Snackbar + Alert で操作結果を統一表示する。
// ui-guidelines.md §8 準拠。
// AuthLayout 配下では使用しない（認証画面では FormAlert を使用する）。

import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

/** トースト通知の種別（ui-guidelines.md §8 準拠） */
export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface AppToastProps {
  /** トーストの表示状態 */
  open: boolean;
  /** 通知の種別 */
  severity: ToastSeverity;
  /** 通知メッセージ */
  message: string;
  /** 閉じるコールバック */
  onClose: () => void;
  /**
   * 自動非表示までの時間（ミリ秒）。
   * null で自動非表示を無効化。
   * severity が 'error' の場合は null がデフォルト。
   */
  autoHideDuration?: number | null;
}

/**
 * AppToast は操作結果の通知を Snackbar + Alert で統一表示する。
 * 表示位置は画面上部中央。
 * 成功通知は5秒で自動非表示、エラー通知は手動で閉じる。
 *
 * 認証画面（AuthLayout 配下）では使用しない。
 * 認証エラーは FormAlert で表示する。
 */
export default function AppToast({
  open,
  severity,
  message,
  onClose,
  autoHideDuration,
}: AppToastProps) {
  // エラー通知は手動で閉じる（自動非表示しない）
  const duration =
    autoHideDuration !== undefined
      ? autoHideDuration
      : severity === 'error'
        ? null
        : 5000;

  const handleClose = (_event: React.SyntheticEvent | Event, reason?: string) => {
    // クリックアウェイは閉じない
    if (reason === 'clickaway') return;
    onClose();
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={onClose}
        severity={severity as AlertColor}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
