// TenantInfoField: ラベルと値のペアを読み取り専用で表示するコンポーネント。
// MVP ではテナント情報は会社名のみだが、Phase 3 での項目追加に対応できる汎用設計とする。

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** TenantInfoField コンポーネントの Props。 */
interface TenantInfoFieldProps {
  /** フィールドのラベル */
  label: string;
  /** フィールドの値 */
  value: string;
}

/**
 * TenantInfoField はラベルと値のペアを表示するコンポーネント。
 * dt/dd の代わりに Box + Typography を用いてシンプルな縦並びで表示する。
 */
export default function TenantInfoField({ label, value }: TenantInfoFieldProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Box>
  );
}
