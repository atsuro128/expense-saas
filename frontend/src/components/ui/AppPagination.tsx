// ページネーションコントロールコンポーネント。
// screens.md §4.9 準拠。
// ページ番号 + 前へ/次へボタンを表示し、現在のページ番号をハイライトする。

import Pagination from '@mui/material/Pagination';
import Box from '@mui/material/Box';
import type { ChangeEvent } from 'react';

export interface AppPaginationProps {
  /** 現在のページ番号 */
  currentPage: number;
  /** 総ページ数 */
  totalPages: number;
  /** ページ変更時のコールバック */
  onPageChange: (page: number) => void;
  /** 無効化（ローディング中など） */
  disabled?: boolean;
}

/**
 * AppPagination は MUI Pagination ラッパー。
 * 総ページ数が多い場合は省略表示する（例: 1 2 3 ... 8 9 10）。
 * AppPaginationFooter 経由で利用する場合は呼び出し側で Math.max(totalPages, 1) を渡すこと
 * （issue #147 Q3: 常時表示前提）。
 */
export default function AppPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: AppPaginationProps) {
  const handleChange = (_event: ChangeEvent<unknown>, page: number) => {
    onPageChange(page);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }} data-testid="app-pagination">
      <Pagination
        count={totalPages}
        page={currentPage}
        onChange={handleChange}
        disabled={disabled}
        color="primary"
        showFirstButton
        showLastButton
      />
    </Box>
  );
}
