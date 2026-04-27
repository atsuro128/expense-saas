// ページネーションフッターコンポーネント。
// 一覧画面のフッター 1 行に「中央: ページ番号（AppPagination）／右: 表示件数セレクタ（PageSizeSelector）」を並置する。
// common-components.md §AppPaginationFooter 準拠。
// レスポンシブ対応として 375px 等のスマホ幅では縦並びにフォールバックする。
// 配置: AppDataGrid の slots.footer 経由で DataGrid フッターコンテナに統合する（issue #147 再オープン D-1）。
// テーブル外の独立 Box として配置しないため、外側マージン mt={2} は不要（DataGrid フッターコンテナが余白を管理する）。

import Box from '@mui/material/Box';
import AppPagination from './AppPagination';
import PageSizeSelector from './PageSizeSelector';

export interface AppPaginationFooterProps {
  /** 現在のページ番号 */
  currentPage: number;
  /** 総ページ数（0 や 1 でも内部で Math.max(totalPages, 1) を適用して常時表示） */
  totalPages: number;
  /** ページ変更時のコールバック */
  onPageChange: (page: number) => void;
  /** 現在の表示件数 */
  perPage: number;
  /** 表示件数変更時のコールバック（呼び出し側で URL 更新と page=1 リセットを行う） */
  onPerPageChange: (size: number) => void;
  /** PageSizeSelector に渡す標準選択肢（省略時は PageSizeSelector のデフォルト [10,20,50,100]） */
  standardOptions?: number[];
  /** ローディング中などで無効化（AppPagination / PageSizeSelector 双方に伝播） */
  disabled?: boolean;
}

/**
 * AppPaginationFooter は AppPagination と PageSizeSelector を 1 行に合成するフッターコンポーネント。
 * 常時表示（issue #147 Q3）: totalPages が 0 や 1 でも非表示にせず Math.max(totalPages, 1) を渡す。
 * xs（< 600px）では縦並び、sm 以上では横並び（中央: AppPagination、右: PageSizeSelector）。
 * sm 以上で AppPagination を中央に配置するため、左側にスペーサー Box を配置する。
 */
export default function AppPaginationFooter({
  currentPage,
  totalPages,
  onPageChange,
  perPage,
  onPerPageChange,
  standardOptions,
  disabled = false,
}: AppPaginationFooterProps) {
  // 常時表示のため totalPages が 0 以下の場合は 1 として扱う（issue #147 Q3）。
  const normalizedTotalPages = Math.max(totalPages, 1);

  return (
    <Box
      data-testid="app-pagination-footer"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexDirection={{ xs: 'column', sm: 'row' }}
      gap={{ xs: 1, sm: 0 }}
    >
      {/*
       * sm 以上で AppPagination を中央寄せするためのスペーサー。
       * space-between レイアウトにおいて左端を埋めることで AppPagination が中央に来る。
       * xs では縦並びレイアウトを優先するため非表示にする。
       */}
      <Box flex={1} sx={{ display: { xs: 'none', sm: 'block' } }} />

      {/* 中央: ページ番号コントロール */}
      <AppPagination
        currentPage={currentPage}
        totalPages={normalizedTotalPages}
        onPageChange={onPageChange}
        disabled={disabled}
      />

      {/* 右: 表示件数セレクタ */}
      <Box flex={1} display="flex" justifyContent="flex-end">
        <PageSizeSelector
          perPage={perPage}
          standardOptions={standardOptions}
          onPerPageChange={onPerPageChange}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
}
