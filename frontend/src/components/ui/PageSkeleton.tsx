// API 通信中のローディング表示コンポーネント。
// screens.md §4.5 準拠。
// 一覧画面用（table）、詳細画面用（card）、フォーム用（form）の3種類を variant で切り替える。

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

export interface PageSkeletonProps {
  /** スケルトンの表示パターン */
  variant: 'table' | 'card' | 'form';
  /** テーブル行数（variant が 'table' の場合に使用。デフォルト: 5） */
  rows?: number;
}

/**
 * テーブル用スケルトン（一覧画面で使用）
 */
function TableSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={1}>
      {/* ヘッダー行 */}
      <Skeleton variant="rectangular" height={48} />
      {/* データ行 */}
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} variant="rectangular" height={52} />
      ))}
    </Stack>
  );
}

/**
 * カード用スケルトン（詳細画面で使用）
 */
function CardSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="text" width="40%" height={40} />
      <Skeleton variant="rectangular" height={120} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="text" width="30%" />
      </Box>
      <Skeleton variant="rectangular" height={200} />
    </Stack>
  );
}

/**
 * フォーム用スケルトン（フォーム画面で使用）
 */
function FormSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="text" width="50%" height={40} />
      <Skeleton variant="rectangular" height={56} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
        <Skeleton variant="rectangular" height={56} sx={{ flex: 1 }} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Skeleton variant="rectangular" width={100} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </Box>
    </Stack>
  );
}

/**
 * PageSkeleton は API 通信中のローディング表示を提供する。
 * variant で一覧・詳細・フォームのパターンを切り替える。
 * テスト識別のため data-testid と data-variant を付与する。
 */
export default function PageSkeleton({ variant, rows = 5 }: PageSkeletonProps) {
  if (variant === 'table') {
    return (
      <Box data-testid="page-skeleton" data-variant="table">
        <TableSkeleton rows={rows} />
      </Box>
    );
  }
  if (variant === 'card') {
    return (
      <Box data-testid="page-skeleton" data-variant="card">
        <CardSkeleton />
      </Box>
    );
  }
  return (
    <Box data-testid="page-skeleton" data-variant="form">
      <FormSkeleton />
    </Box>
  );
}
