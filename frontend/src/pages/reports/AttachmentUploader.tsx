// AttachmentUploader コンポーネント。
// ファイルアップロード UI を提供する（ファイル選択・バリデーション・アップロード）。
// report-detail.md §AttachmentUploader に対応する。

import { useState, useRef } from 'react';
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
 * AttachmentUploader は「+ ファイルを追加」ボタンとファイルアップロード機能を提供する。
 * ファイル形式（JPEG, PNG, PDF）とサイズ（5MB）のクライアントサイドバリデーションを行う。
 * バリデーション通過後に useUploadAttachment Hook を通じて API を呼び出してファイルをアップロードする。
 */
export default function AttachmentUploader({
  reportId,
  itemId,
  onUploadSuccess,
  onUploadError,
}: AttachmentUploaderProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
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

  // ドロップゾーンの dragover イベントハンドラ（デフォルト動作を防ぐ）。
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // ドロップゾーンの drop イベントハンドラ。
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    handleFile(file);
  };

  return (
    <div
      data-testid="attachment-uploader"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <label>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          data-testid="attachment-file-input"
          disabled={isPending}
          onChange={handleChange}
        />
        <span data-testid="attachment-upload-button">
          {isPending ? 'アップロード中...' : '+ ファイルを追加'}
        </span>
      </label>
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
