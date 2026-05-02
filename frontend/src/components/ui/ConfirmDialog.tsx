// 操作前の確認ダイアログコンポーネント。
// screens.md §4.6 準拠。
// 提出・削除・承認・却下・支払完了の確認に使用する。
// 却下理由入力・承認コメント入力のオプションフィールドに対応する。
//
// 修正履歴:
//   #156 - open=false の閉じるアニメーション中に title/message がちらつく問題を修正。
//          usePrevious で open=false の間は前回の title/message を保持する。
//   #159 - inputField.required + onBlur 時にエラー文言を helperText に表示する機能を追加。
//          InputFieldConfig に errorMessage? プロパティを追加。
//   #156/#159 (大幅改修) - 全表示 props（title/message/confirmLabel/confirmColor/inputField/apiError）を
//          usePrevious で保持し、閉じる際の全要素ちらつきを完全防止。
//          apiError prop を追加し、422 等の API エラー文言を FormAlert でダイアログ本文上部に表示する。
//   #162 - 初期表示時のバリデーションエラー / ボタン disabled regression 修正。
//          isConfirmDisabled から未入力条件（inputValue.trim() === ''）を削除し loading のみに絞る。
//          代わりに handleConfirm 内で未入力なら setTouched(true) のみ実行して onConfirm を呼ばない
//          ガードを追加（クライアントバリデーション = onBlur + onSubmit の二点発火）。
//          apiError の責務はサーバー応答エラー専用（null のとき FormAlert は描画せず、disabled も発火させない）。

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import FormAlert from './FormAlert';
import { usePrevious } from '../../hooks/usePrevious';

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
  /**
   * required=true のとき、onBlur + 未入力で helperText に表示するエラー文言。
   * 省略した場合は文字数カウンタのみ表示される（エラー文言は出ない）。
   */
  errorMessage?: string;
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
  /**
   * API エラー文言（422 MissingRejectionReason 等）。
   * null のとき非表示。FormAlert でダイアログ本文上部に表示する。
   * エラー時はダイアログを閉じず open を維持したまま apiError を set することで
   * 設計書 report-detail.md §D4 MissingRejectionReason 規定に準拠する。
   */
  apiError?: string | null;
  /** 確認ボタン押下時のコールバック。inputField がある場合は入力値を引数で受け取る */
  onConfirm: (inputValue?: string) => void;
  /** キャンセル・ダイアログ外クリック時のコールバック */
  onCancel: () => void;
}

/**
 * ConfirmDialog は操作前の確認ダイアログを提供する。
 * 却下理由・承認コメント等のテキスト入力フィールドをオプションで表示できる。
 *
 * ## ちらつき防止（#156 大幅改修）
 * open=false の閉じるアニメーション中に全表示 props（title/message/confirmLabel/confirmColor/
 * inputField/apiError）が変化する問題を防ぐため、usePrevious を使い
 * 「open=true の間は props の値を採用し、open=false になったら前回の値を保持する」
 * ロジックを全表示 props に適用している。
 *
 * ## 必須バリデーション（#159）
 * inputField.required=true のとき、onBlur で touched フラグを立て、
 * 未入力の場合は helperText に inputField.errorMessage を赤字で表示する。
 * onChange で入力が始まったらエラー状態を解除する。
 *
 * ## API エラー表示（#156/#159 大幅改修）
 * apiError prop が設定されると FormAlert で本文上部に表示する。
 * 成功時はダイアログを閉じ（open=false）、エラー時はダイアログを開いたまま
 * apiError を set することで「エラーをダイアログ内で表示する」設計書規定に準拠する。
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
  apiError = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  // onBlur が一度でも発生したかどうかを追跡する（バリデーション表示制御用）。
  const [touched, setTouched] = useState(false);

  // ダイアログが閉じた時点で入力値と touched 状態をリセットする。
  // onCancel 経由（handleClose）だけでなく onConfirm 成功時の外部からの open=false にも追従する。
  // これにより「却下成功 → 再度却下フローを開く」際に touched=true が引き継がれて
  // 初回 render から赤字エラーが出る挙動を防ぐ。
  useEffect(() => {
    if (!open) {
      setInputValue('');
      setTouched(false);
    }
  }, [open]);

  // --- ちらつき防止: open=false の間は全表示 props の前回値を保持する (#156 大幅改修) ---
  // open=true のときは現在の props 値を使い、
  // open=false（閉じるアニメーション中）は usePrevious で前回値を維持する。
  // これにより、workflowDialogAction=null になった瞬間に confirmLabel が
  // 「支払完了にする」にフォールバックしたり、inputField が undefined になって
  // 却下理由欄が消えたりする問題を完全防止する。
  const prevTitle = usePrevious(title);
  const prevMessage = usePrevious(message);
  const prevConfirmLabel = usePrevious(confirmLabel);
  const prevConfirmColor = usePrevious(confirmColor);
  const prevInputField = usePrevious(inputField);
  const prevApiError = usePrevious(apiError);

  const displayTitle = open ? title : (prevTitle ?? title);
  const displayMessage = open ? message : (prevMessage ?? message);
  const displayConfirmLabel = open ? confirmLabel : (prevConfirmLabel ?? confirmLabel);
  const displayConfirmColor = open ? confirmColor : (prevConfirmColor ?? confirmColor);
  const displayInputField = open ? inputField : (prevInputField ?? inputField);
  const displayApiError = open ? apiError : (prevApiError ?? apiError);

  // --- 必須バリデーション (#159) ---
  // required=true かつ touched かつ入力が空のとき、エラー状態とみなす。
  const isInvalid =
    (displayInputField?.required === true) && touched && (inputValue.trim() === '');

  const handleConfirm = () => {
    // 必須フィールドが未入力の場合はクライアントバリデーションを発火させ、onConfirm を呼ばない（#162）。
    // isConfirmDisabled から未入力条件を削除した代わりに、押下時にバリデーションを発火させる。
    if (displayInputField?.required === true && inputValue.trim() === '') {
      setTouched(true);
      return;
    }
    if (displayInputField) {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  // ダイアログが閉じた後に入力値と touched 状態をリセットする。
  const handleClose = () => {
    onCancel();
    setInputValue('');
    setTouched(false);
  };

  // 多重送信防止のため loading 中のみ disabled にする（#162: 未入力時 disabled は廃止し、押下時バリデーションに切替）。
  // apiError はサーバー応答エラー専用。disabled 発火条件には含めない。
  const isConfirmDisabled = loading;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{displayTitle}</DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        {/* API エラー（422 MissingRejectionReason 等）をダイアログ本文上部に表示する。
            null のときは FormAlert が何も描画しない（FormAlert の仕様）。 */}
        <FormAlert message={displayApiError ?? null} />
        <DialogContentText>{displayMessage}</DialogContentText>
        {displayInputField && (
          <TextField
            margin="normal"
            label={displayInputField.label}
            placeholder={displayInputField.placeholder}
            required={displayInputField.required}
            multiline={displayInputField.multiline}
            rows={displayInputField.multiline ? 4 : 1}
            fullWidth
            size="small"
            inputProps={{ maxLength: displayInputField.maxLength }}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // 入力が始まったらエラー状態を解除する（UX 向上）。
              if (e.target.value.trim() !== '' && touched) {
                setTouched(false);
              }
            }}
            onBlur={() => setTouched(true)}
            error={isInvalid}
            helperText={
              isInvalid && displayInputField.errorMessage
                ? displayInputField.errorMessage
                : `${inputValue.length} / ${displayInputField.maxLength}`
            }
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
          color={displayConfirmColor}
          disabled={isConfirmDisabled}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {displayConfirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
