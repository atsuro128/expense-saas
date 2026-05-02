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
    // overflowX: 'auto' で列幅合計が画面幅を超える場合に横スクロールを許可する（issue #160 対応）。
    // minWidth: 0 で親 flex container 内での min-width: auto 膨張を抑止する（issue #160 再対応）。
    // 親が display: flex のとき flex item の min-width 既定値は auto（コンテンツ幅に追従）であり、
    // Box が 726px に膨張して overflowX: 'auto' が発火しない CSS Flexbox の罠を回避する。
    <Box sx={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
      <DataGrid
        {...rest}
        columns={columns}
        rows={rows}
        loading={loading}
        localeText={jaJP.components.MuiDataGrid.defaultProps.localeText}
        // ページネーションはデフォルト無効（AppPagination で制御する画面あり）
        hideFooterPagination={rest.hideFooterPagination ?? false}
        disableRowSelectionOnClick
        slots={{
          // デフォルトの noRowsOverlay（emptyMessage を表示）を先に定義し、
          // 呼び出し側の slots（rest.slots）を後から展開して上書きを許可する。
          // これにより呼び出し側は noRowsOverlay を自前実装で差し替えられる。
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
          // 呼び出し側の slots を後から展開して合成する。
          // footer 等の追加スロットはここで引き継がれる。
          // noRowsOverlay を呼び出し側で渡した場合は上記デフォルトを上書きする。
          ...rest.slots,
        }}
        sx={{
          // ヘッダーのフォントを太字にする
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 'bold',
          },
          // rows=0 件時のみ EmptyState（アクションボタン付き）が画面内に収まる minHeight を確保する。
          // 1 件以上は DataGrid の自然高さに任せる（不要な余白を防ぐ）。
          // 361px の根拠（overlayWrapperInner と EmptyState の高さを一致させ centering slack を 0 にする）:
          //   ColumnHeader 56 + EmptyState 必要量 236.5 (icon 48 + msg 24 + button 36 + gaps 32 + py 上下 96)
          //   + filler 15 + AppPaginationFooter 53 = 360.5。丸めて 361。
          //   button と footer 間の視覚余白は EmptyState 自身の py-bottom 48px で確保される。
          minHeight: rows.length === 0 ? 361 : undefined,
          // 呼び出し側の sx を後から展開して合成する。
          ...rest.sx,
        }}
      />
    </Box>
  );
}
