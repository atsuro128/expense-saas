// 操作前の確認ダイアログコンポーネント。
// screens.md §4.6 準拠。
// 提出・削除・承認・却下・支払完了の確認に使用する。
// 却下理由入力・承認コメント入力のオプションフィールドに対応する。

import { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

/** 確認ダイアログのオプションテキスト入力フィールド設定 */
interface InputFieldConfig {
  /** 入力フィールドのラベル */
  label: string;
  /** プレースホルダー */
  placeholder?: string;
  /** 必須か（却下理由: true、承認コメント: false） */
  required: boolean;
  /** 最大文字数（1000文字） */
  maxLength: number;
  /** 複数行入力か */
  multiline: boolean;
}

export interface ConfirmDialogProps {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログのタイトル */
  title: string;
  /** ダイアログ本文メッセージ */
  message: string;
  /** 確認ボタンのテキスト（例: 「提出する」「削除する」「承認する」「却下する」「支払完了にする」） */
  confirmLabel: string;
  /** 確認ボタンの色（ui-guidelines.md ボタン使い分け準拠） */
  confirmColor?: 'primary' | 'error' | 'success' | 'secondary';
  /** キャンセルボタンのテキスト（デフォルト: 「キャンセル」） */
  cancelLabel?: string;
  /** テキスト入力フィールドの設定（却下理由・承認コメント用） */
  inputField?: InputFieldConfig;
  /** 処理中かどうか（true の場合、確認ボタンを disabled + スピナー表示） */
  loading?: boolean;
  /** 確認ボタン押下時のコールバック。inputField がある場合は入力値を引数で受け取る */
  onConfirm: (inputValue?: string) => void;
  /** キャンセル・ダイアログ外クリック時のコールバック */
  onCancel: () => void;
}

/**
 * ConfirmDialog は操作前の確認ダイアログを提供する。
 * 却下理由・承認コメント等のテキスト入力フィールドをオプションで表示できる。
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmColor = 'primary',
  cancelLabel = 'キャンセル',
  inputField,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    if (inputField) {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  // ダイアログが閉じた後に入力値をリセット
  const handleClose = () => {
    onCancel();
    setInputValue('');
  };

  // 入力必須フィールドが空の場合は確認ボタンを無効化
  const isConfirmDisabled =
    loading || (inputField?.required === true && inputValue.trim() === '');

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <DialogContentText>{message}</DialogContentText>
        {inputField && (
          <TextField
            autoFocus
            margin="normal"
            label={inputField.label}
            placeholder={inputField.placeholder}
            required={inputField.required}
            multiline={inputField.multiline}
            rows={inputField.multiline ? 4 : 1}
            fullWidth
            size="small"
            inputProps={{ maxLength: inputField.maxLength }}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            helperText={`${inputValue.length} / ${inputField.maxLength}`}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="outlined" disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          disabled={isConfirmDisabled}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
