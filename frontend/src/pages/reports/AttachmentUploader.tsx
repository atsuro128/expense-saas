// AttachmentUploader コンポーネント。
// ファイルアップロード UI を提供する（ファイル選択・バリデーション・アップロード）。
// report-detail.md §AttachmentUploader に対応する。
// ATT-FE-059/060: AbortController によるアップロード中断対応（issue #108）。
// ATT-FE-073/074: 追加モードでのローカル保持対応（issue #115）。

import { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useUploadAttachment } from '../../hooks/useUploadAttachment';

/** パネルモード（追加・編集・閲覧）。 */
export type UploaderMode = 'add' | 'edit' | 'view';

export interface AttachmentUploaderProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID（追加モードでは null） */
  itemId: string | null;
  /** パネルモード。追加モードではファイルをローカル state に保留し即時アップロードしない。 */
  mode?: UploaderMode;
  /** アップロード成功時のコールバック（編集モードのみ即時コール） */
  onUploadSuccess: () => void;
  /** アップロードエラー時のコールバック（省略時は console.error のみ） */
  onUploadError?: (message: string) => void;
  /** アップロードが中断されたときのコールバック（AbortError 発生時） */
  onUploadAborted?: () => void;
  /** アップロード中状態の変化を親に通知するコールバック */
  onUploadingChange?: (isUploading: boolean) => void;
  /** アップロードキャンセル関数を外部に公開するための ref（パネルクローズ時に ItemSlidePanel から呼ぶ） */
  cancelRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * 追加モードでファイルが保留 state に追加されたときのコールバック。
   * mode='add' のとき、バリデーション通過後に呼ばれる。
   */
  onPendingFileAdded?: (file: File) => void;
  /**
   * 追加モードで保留ファイル一覧が変化したときのコールバック。
   * ItemSlidePanel が保存時の順次アップロードに使う File 一覧を取得するために使用する。
   */
  onPendingFilesChange?: (files: File[]) => void;
}

// 許可された MIME タイプ（files.md §3）。
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
// ファイルサイズ制限: 5MB（files.md §3）。
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// 許可 MIME タイプのセット（高速判定用）。
const ALLOWED_MIME_SET: ReadonlySet<string> = new Set(ALLOWED_MIME_TYPES);

// MUI 公式パターン（VisuallyHiddenInput）: 視覚的に隠しつつアクセシビリティを保つ input スタイル。
// アクセシビリティのために DOM に存在させつつ、ブラウザのネイティブ描画を非表示にする。
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

/**
 * ファイルのクライアントサイドバリデーションを行う。
 * エラーがあればエラーメッセージを返し、問題なければ null を返す。
 */
function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_SET.has(file.type)) {
    return '許可されていないファイル形式です（対応: JPEG, PNG, PDF）';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `ファイルサイズが上限（5MB）を超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`;
  }
  return null;
}

/**
 * AttachmentUploader は「ファイルを追加」ボタンとファイルアップロード機能を提供する。
 * ファイル形式（JPEG, PNG, PDF）とサイズ（5MB）のクライアントサイドバリデーションを行う。
 *
 * mode='add'（追加モード）: バリデーション通過後にローカル state（pendingFiles）へ保留し、
 *   「保存後にアップロード予定」ラベル付きの一覧を表示する。
 *   useUploadAttachment.mutate は呼ばない。onPendingFileAdded / onPendingFilesChange で親に通知する。
 *
 * mode='edit'（編集モード）またはデフォルト: バリデーション通過後に useUploadAttachment Hook
 *   を通じて API を呼び出してファイルをアップロードする。
 *
 * ドラッグ&ドロップにも対応し、dragover 時に視覚的フィードバックを提供する。
 * パネルクローズ時に AbortController でアップロードを中断し、onUploadAborted を通知する（issue #108）。
 */
export default function AttachmentUploader({
  reportId,
  itemId,
  mode = 'edit',
  onUploadSuccess,
  onUploadError,
  onUploadAborted,
  onUploadingChange,
  cancelRef,
  onPendingFileAdded,
  onPendingFilesChange,
}: AttachmentUploaderProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  // ドラッグ中の視覚フィードバック用フラグ。
  const [isDragOver, setIsDragOver] = useState(false);
  // 追加モードでのローカル保留ファイル一覧（mode='add' のみ使用）。
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 追加モード: isPending は常に false（即時アップロードしない）。
  // 編集モード: useUploadAttachment Hook からミューテーション関数・アップロード中フラグ・キャンセル関数を取得する。
  // onUploadAborted を渡すことで、unmount 時（明細切替）の中断を Hook レベルで直接通知する（issue #108 §7-2）。
  const { mutate, isPending, cancel } = useUploadAttachment({ onAborted: onUploadAborted });

  // cancelRef にキャンセル関数を登録して、外部（ItemSlidePanel）からパネルクローズ時に呼べるようにする。
  // cancel は Hook 内で毎 render 再生成されるが、ref への登録はマウント時の 1 回で十分
  // （cancel は常に abortControllerRef.current を参照する）。
  // 依存配列に [cancel, cancelRef] を明記して React の useEffect hygiene を遵守する（issue #108 FIX 3）。
  useEffect(() => {
    if (cancelRef) {
      cancelRef.current = cancel;
    }
    return () => {
      if (cancelRef) {
        cancelRef.current = null;
      }
    };
  }, [cancel, cancelRef]);

  // 保留ファイル一覧が変化したら親コンポーネントに通知する（ItemSlidePanel の順次アップロードで使用）。
  useEffect(() => {
    if (mode === 'add') {
      onPendingFilesChange?.(pendingFiles);
    }
  // onPendingFilesChange の参照変化ではなく pendingFiles の変化を契機にする。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles, mode]);

  // 追加モードでは isPending を使わない（常に false 扱い）。
  const isUploading = mode !== 'add' && isPending;

  // ファイルを選択してアップロードを開始する（または追加モードでローカル保留する）。
  const handleFile = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);

    if (mode === 'add') {
      // 追加モード: ファイルをローカル state に保留（API は呼ばない）。
      setPendingFiles((prev) => [...prev, file]);
      onPendingFileAdded?.(file);
      return;
    }

    // 編集モード（デフォルト）: 即時アップロード。
    if (!itemId) {
      // itemId が null の場合は編集モードでも何もしない（防衛的処理）。
      return;
    }
    // アップロード開始を親に通知する。
    onUploadingChange?.(true);
    // バリデーション通過後に Hook 経由でアップロード API を呼び出す。
    mutate(
      { reportId, itemId, file },
      {
        onSuccess: () => {
          onUploadingChange?.(false);
          onUploadSuccess();
        },
        onError: (err) => {
          onUploadingChange?.(false);
          // AbortError（アップロード中断）を識別して専用コールバックを呼ぶ。
          if (err instanceof Error && err.name === 'AbortError') {
            onUploadAborted?.();
            return;
          }
          // AbortError 以外のエラーは client.ts 層でマッピング済みの err.message をそのまま使う。
          // err が Error インスタンスでない場合のフォールバック文言のみここに持つ。
          const message = err instanceof Error ? err.message : 'ファイルのアップロードに失敗しました';
          if (onUploadError) {
            onUploadError(message);
          }
        },
      },
    );
  };

  // 追加モードの保留ファイルを削除するハンドラ（index 指定）。API は呼ばない・確認ダイアログなし。
  const handlePendingFileRemove = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ファイル入力の change イベントハンドラ。
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
    // 同じファイルを再選択できるように入力値をリセットする。
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ドロップゾーンの dragover イベントハンドラ（デフォルト動作を防ぎ、視覚フィードバックを有効化）。
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isUploading) return;
    setIsDragOver(true);
  };

  // ドロップゾーンの dragleave イベントハンドラ（視覚フィードバックを解除）。
  // 子要素間の移動で発火する dragleave を無視し、ドロップゾーン外への離脱のみ反応する。
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  // ドロップゾーンの drop イベントハンドラ。
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    handleFile(file);
  };

  return (
    <div
      data-testid="attachment-uploader"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 追加モードの保留ファイル一覧（mode='add' のみ表示）。
          各ファイルに「保存後にアップロード予定」ラベルと削除ボタンを表示する（ATT-FE-073/075/077）。 */}
      {mode === 'add' && pendingFiles.length > 0 && (
        <List dense>
          {pendingFiles.map((file, index) => (
            <ListItem
              key={`pending-${index}-${file.name}`}
              data-testid={`pending-file-row-${index}`}
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  aria-label={`削除-${index}`}
                  onClick={() => handlePendingFileRemove(index)}
                  data-testid={`pending-attachment-delete-${index}`}
                >
                  ×
                </IconButton>
              }
            >
              <Typography variant="body2" sx={{ mr: 1 }}>
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                ({(file.size / 1024).toFixed(0)} KB)
              </Typography>
              <Typography
                variant="caption"
                color="warning.main"
                sx={{ fontStyle: 'italic' }}
              >
                保存後にアップロード予定
              </Typography>
            </ListItem>
          ))}
        </List>
      )}
      {/* ドラッグ&ドロップゾーン: 点線ボーダーで視覚化し、dragover 時にボーダー色・背景色でフィードバックする */}
      <div
        data-testid="attachment-drop-zone"
        data-drag-over={isDragOver ? 'true' : 'false'}
        style={{
          border: isDragOver ? '2px dashed #1976d2' : '2px dashed #bdbdbd',
          borderRadius: 8,
          padding: '16px',
          textAlign: 'center',
          backgroundColor: isDragOver ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        <div style={{ marginBottom: 8, color: '#757575', fontSize: 14 }}>
          ここにファイルをドロップ、または
        </div>
        {/* MUI Button に VisuallyHiddenInput を内包するパターン（MUI v5+ 公式推奨）。 */}
        {/* Button クリック / キーボード（Enter/Space）で input への click が連鎖する。 */}
        <Button
          component="label"
          variant="outlined"
          disabled={isUploading}
          startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          data-testid="attachment-upload-button"
        >
          {isUploading ? 'アップロード中...' : 'ファイルを追加'}
          <VisuallyHiddenInput
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            data-testid="attachment-file-input"
            disabled={isUploading}
            onChange={handleChange}
          />
        </Button>
      </div>
      <div data-testid="attachment-file-types">
        対応形式: JPEG, PNG, PDF（最大 {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB）
      </div>
      {validationError && (
        <div data-testid="attachment-validation-error" role="alert">
          {validationError}
        </div>
      )}
      {/* 追加モードでのローカル保留案内（ATT-FE-073）。
          バリデーション通過後にコールバック経由で親コンポーネントが保留一覧を表示する。 */}
      {mode === 'add' && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          ファイルを選択すると保存時にまとめてアップロードします。
        </Typography>
      )}
    </div>
  );
}
