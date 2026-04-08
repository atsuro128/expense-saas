// AttachmentUploader コンポーネント（スタブ）。
// ファイルアップロード UI を提供する（ファイル選択・バリデーション・アップロード）。
// report-detail.md §AttachmentUploader に対応する。

export interface AttachmentUploaderProps {
  /** レポート ID */
  reportId: string;
  /** 明細 ID */
  itemId: string;
  /** アップロード成功時のコールバック */
  onUploadSuccess: () => void;
  /** アップロード中フラグ */
  isUploading: boolean;
}

// 許可された MIME タイプ（files.md §3）。
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
// ファイルサイズ制限: 5MB（files.md §3）。
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * AttachmentUploader は「+ ファイルを追加」ボタンとファイルアップロード機能を提供する。
 * ファイル形式（JPEG, PNG, PDF）とサイズ（5MB）のクライアントサイドバリデーションを行う。
 */
export default function AttachmentUploader({
  reportId: _reportId,
  itemId: _itemId,
  onUploadSuccess: _onUploadSuccess,
  isUploading,
}: AttachmentUploaderProps) {
  // _reportId・_itemId・_onUploadSuccess は機能実装時に使用する（スタブでは未使用）。

  return (
    <div data-testid="attachment-uploader">
      <label>
        <input
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          data-testid="attachment-file-input"
          disabled={isUploading}
        />
        <span data-testid="attachment-upload-button">
          {isUploading ? 'アップロード中...' : '+ ファイルを追加'}
        </span>
      </label>
      <div data-testid="attachment-file-types">
        対応形式: JPEG, PNG, PDF（最大 {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB）
      </div>
    </div>
  );
}
