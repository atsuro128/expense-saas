/**
 * ファイルサイズをバイト数から人間が読みやすい文字列に変換する。
 * - 1024 バイト未満: `N B`
 * - 1024 バイト以上 1MB 未満: `N KB`（四捨五入）
 * - 1MB 以上: `N.N MB`（小数点以下 1 桁）
 *
 * @param bytes バイト数（非負整数）
 * @returns フォーマット済みの文字列（例: `240 KB`, `2.7 MB`）
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
