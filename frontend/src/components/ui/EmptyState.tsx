// データが存在しない場合の空状態メッセージコンポーネント。
// screens.md §4.7 準拠。

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import InboxIcon from '@mui/icons-material/Inbox';

export interface EmptyStateProps {
  /** 空状態のメッセージテキスト */
  message: string;
  /** アクションボタン（例: レポート作成ボタン）。任意 */
  action?: {
    /** ボタンのテキスト */
    label: string;
    /** ボタン押下時のコールバック */
    onClick: () => void;
  };
}

/**
 * EmptyState はデータが0件の場合に表示する空状態コンポーネント。
 * オプションのアクションボタンを表示できる。
 */
export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        gap: 2,
      }}
    >
      <InboxIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
      {action && (
        <Button variant="contained" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Box>
  );
}
