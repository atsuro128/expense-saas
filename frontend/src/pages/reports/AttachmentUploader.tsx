// AttachmentUploader コンポーネント。
// ファイルアップロード UI を提供する（ファイル選択・バリデーション・アップロード）。
// report-detail.md §AttachmentUploader に対応する。

import { useState, useRef } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useUploadAttachment } from '../../hooks/useUploadAttachment';

export interface AttachmentUploaderProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID */
  itemId: string;
  /** アップロード成功時のコールバック */
  onUploadSuccess: () => void;
  /** アップロードエラー時のコールバック（省略時は console.error のみ） */
  onUploadError?: (message: string) => void;
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
 * バリデーション通過後に useUploadAttachment Hook を通じて API を呼び出してファイルをアップロードする。
 * ドラッグ&ドロップにも対応し、dragover 時に視覚的フィードバックを提供する。
 */
export default function AttachmentUploader({
  reportId,
  itemId,
  onUploadSuccess,
  onUploadError,
}: AttachmentUploaderProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  // ドラッグ中の視覚フィードバック用フラグ。
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useUploadAttachment Hook からミューテーション関数とアップロード中フラグを取得する。
  const { mutate, isPending } = useUploadAttachment();

  // ファイルを選択してアップロードを開始する。
  const handleFile = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    // バリデーション通過後に Hook 経由でアップロード API を呼び出す。
    mutate(
      { reportId, itemId, file },
      {
        onSuccess: () => onUploadSuccess(),
        onError: (err) => {
          // エラーをログに記録し、コールバックで親コンポーネントに通知する。
          console.error('ファイルのアップロードに失敗しました:', err);
          const message = 'ファイルのアップロードに失敗しました。もう一度お試しください。';
          if (onUploadError) {
            onUploadError(message);
          }
        },
      },
    );
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
    if (isPending) return;
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
    if (isPending) return;
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
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          data-testid="attachment-upload-button"
        >
          {isPending ? 'アップロード中...' : 'ファイルを追加'}
          <VisuallyHiddenInput
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            data-testid="attachment-file-input"
            disabled={isPending}
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
    </div>
  );
}
