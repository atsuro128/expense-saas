// DataGrid ラッパーコンポーネント。
// 日本語ロケール設定、共通カラム定義（日付・金額フォーマッタ）、
// ソート・フィルタのデフォルト設定を統一する。

import { DataGrid } from '@mui/x-data-grid';
import { jaJP } from '@mui/x-data-grid/locales';
import type { DataGridProps, GridColDef } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export interface AppDataGridProps extends Omit<DataGridProps, 'localeText'> {
  /** カラム定義 */
  columns: GridColDef[];
  /** 行データ */
  rows: readonly Record<string, unknown>[];
  /** ローディング状態 */
  loading?: boolean;
  /** 空状態メッセージ（データが0件の場合に表示） */
  emptyMessage?: string;
}

/**
 * AppDataGrid は MUI DataGrid の共通ラッパー。
 * 日本語ロケールとプロジェクト共通のデフォルト設定を適用する。
 */
export default function AppDataGrid({
  columns,
  rows,
  loading = false,
  emptyMessage = 'データがありません',
  ...rest
}: AppDataGridProps) {
  return (
    <Box sx={{ width: '100%' }}>
      <DataGrid
        columns={columns}
        rows={rows}
        loading={loading}
        localeText={jaJP.components.MuiDataGrid.defaultProps.localeText}
        // ページネーションはデフォルト無効（AppPagination で制御する画面あり）
        hideFooterPagination={rest.hideFooterPagination ?? false}
        disableRowSelectionOnClick
        slots={{
          noRowsOverlay: () => (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {emptyMessage}
              </Typography>
            </Box>
          ),
          ...rest.slots,
        }}
        sx={{
          // ヘッダーのフォントを太字にする
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 'bold',
          },
          ...rest.sx,
        }}
        {...rest}
      />
    </Box>
  );
}
