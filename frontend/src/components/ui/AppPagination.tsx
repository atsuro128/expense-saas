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

  // 1 ページ以下の場合はページネーションを表示しない。
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }} data-testid="app-pagination">
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
