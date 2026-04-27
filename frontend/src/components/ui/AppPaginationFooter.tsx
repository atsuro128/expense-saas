// ページネーションフッターコンポーネント。
// 一覧画面のフッター 1 行に「中央: ページ番号（AppPagination）／右: 表示件数セレクタ（PageSizeSelector）」を並置する。
// common-components.md §AppPaginationFooter 準拠（issue #147 再々オープン A2 案）。
// レスポンシブ対応として 375px 等のスマホ幅では縦並びにフォールバックする。
// 配置: AppDataGrid の slots.footer 経由で DataGrid フッターコンテナに統合する（issue #147 再オープン D-1）。
// テーブル外の独立 Box として配置しないため、外側マージン mt={2} は不要（DataGrid フッターコンテナが余白を管理する）。

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
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
  /**
   * 件数表示用の総件数（issue #147 再々オープン: A2 案）。
   * - 指定された場合、フッター左側に「{start} - {end} / 全 {total} 件」を表示する
   * - 未指定（undefined）の場合は件数表示を非表示にする（後方互換）
   * - currentPage / perPage / totalCount から内部で start/end を算出する
   * - API レスポンスの pagination.total_count をそのまま渡す想定
   */
  totalCount?: number;
}

/**
 * AppPaginationFooter は AppPagination と PageSizeSelector を 1 行に合成するフッターコンポーネント。
 * 常時表示（issue #147 Q3）: totalPages が 0 や 1 でも非表示にせず Math.max(totalPages, 1) を渡す。
 * xs（< 600px）では縦並び、sm 以上では横並び（左: 件数表示、中央: AppPagination、右: PageSizeSelector）。
 * totalCount 指定時は件数表示を左側に追加し、両端 flex={1} で中央寄せを保証する（A2 案確定）。
 * totalCount 未指定時は左スペーサーで後方互換を保つ。
 *
 * ルート Box の sx（A2 案確定値）:
 *   borderTop: '1px solid' + borderColor: 'divider': DataGrid 標準フッターに揃えた境界線
 *   minHeight: 52: MUI 標準 TablePagination の高さ相当
 *   px: 2 / py: 0.5: PageSizeSelector Select 枠線がフッター高さを支配しないための余白調整
 */
export default function AppPaginationFooter({
  currentPage,
  totalPages,
  onPageChange,
  perPage,
  onPerPageChange,
  standardOptions,
  disabled = false,
  totalCount,
}: AppPaginationFooterProps) {
  // 常時表示のため totalPages が 0 以下の場合は 1 として扱う（issue #147 Q3）。
  const normalizedTotalPages = Math.max(totalPages, 1);

  // 件数表示テキストを算出する（totalCount 指定時のみ）。
  // 0 件時: 「0 - 0 / 全 0 件」（フッター常時表示方針と整合して件数 0 を明示する）。
  let countText: string | undefined;
  if (totalCount !== undefined) {
    const start = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, totalCount);
    countText = `${start} - ${end} / 全 ${totalCount} 件`;
  }

  // ルート Box の sx（A2 案確定値）。
  // borderTop / borderColor: DataGrid 標準フッターと境界線を揃える。
  // minHeight: MUI 標準 TablePagination の高さ 52px 相当。
  // px / py: Select 枠線によるフッター高さ支配を防ぐ余白調整。
  const rootSx = {
    borderTop: '1px solid',
    borderColor: 'divider',
    minHeight: 52,
    px: 2,
    py: 0.5,
  };

  if (totalCount !== undefined) {
    // totalCount 指定時: 両端 flex={1} ラッパーで AppPagination を中央寄せ（A2 案確定構造）。
    // xs では flex-direction: column で縦並び（件数表示 → AppPagination → PageSizeSelector 順）。
    // sm 以上では flex-direction: row で横並び（左: 件数表示、中央: AppPagination、右: PageSizeSelector）。
    return (
      <Box
        data-testid="app-pagination-footer"
        display="flex"
        alignItems="center"
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={{ xs: 1, sm: 0 }}
        sx={rootSx}
      >
        {/* 左: 件数表示（xs では一番上、sm 以上では左端 flex={1}） */}
        <Box
          flex={1}
          display="flex"
          justifyContent={{ xs: 'center', sm: 'flex-start' }}
          order={{ xs: 0, sm: 0 }}
        >
          <Typography variant="body2" color="text.secondary" data-testid="app-pagination-footer-count">
            {countText}
          </Typography>
        </Box>

        {/* 中央: ページ番号コントロール */}
        <Box order={{ xs: 1, sm: 1 }}>
          <AppPagination
            currentPage={currentPage}
            totalPages={normalizedTotalPages}
            onPageChange={onPageChange}
            disabled={disabled}
          />
        </Box>

        {/* 右: 表示件数セレクタ（sm 以上では右端 flex={1}） */}
        <Box
          flex={1}
          display="flex"
          justifyContent={{ xs: 'center', sm: 'flex-end' }}
          order={{ xs: 2, sm: 2 }}
        >
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

  // totalCount 未指定時（後方互換）: 左スペーサーで AppPagination を中央寄せする旧仕様を維持。
  // xs ではスペーサーを非表示にして縦並びレイアウトを優先する。
  return (
    <Box
      data-testid="app-pagination-footer"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexDirection={{ xs: 'column', sm: 'row' }}
      gap={{ xs: 1, sm: 0 }}
      sx={rootSx}
    >
      {/*
       * sm 以上で AppPagination を中央寄せするためのスペーサー。
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
