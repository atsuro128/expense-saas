// フォーム下部のアクションボタン群（キャンセル・送信）コンポーネント。
// 右寄せで配置する。
// SCR-RPT-002, SCR-RPT-003 で使用する。

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SubmitButton from '../ui/SubmitButton';

export interface ReportFormActionsProps {
  /** 送信ボタンのラベルテキスト */
  submitLabel: string;
  /** 送信中フラグ（送信ボタンを disabled + スピナー表示） */
  loading: boolean;
  /** キャンセルボタン押下時のコールバック */
  onCancel: () => void;
}

/**
 * ReportFormActions はフォーム下部のアクションボタン群を提供する。
 * キャンセルボタンと送信ボタンを右寄せで配置する。
 */
export default function ReportFormActions({
  submitLabel,
  loading,
  onCancel,
}: ReportFormActionsProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
      <Button variant="outlined" onClick={onCancel} disabled={loading}>
        キャンセル
      </Button>
      <SubmitButton label={submitLabel} loading={loading} fullWidth={false} />
    </Box>
  );
}
