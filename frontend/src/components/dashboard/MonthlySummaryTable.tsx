// 月別合計支出金額テーブルコンポーネント。
// 直近 3 ヶ月のデータを降順で表示する。
// 55_ui_component/screens/dashboard.md §MonthlySummaryTable 準拠。

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface MonthlySummaryItem {
  /** 年月（YYYY-MM 形式） */
  yearMonth: string;
  /** 月別合計金額（円） */
  totalAmount: number;
}

export interface MonthlySummaryTableProps {
  /** 月別支出サマリーデータ（最大3件、降順） */
  items: MonthlySummaryItem[];
}

/**
 * yearMonth（YYYY-MM）を「YYYY年M月」形式の文字列に変換する。
 */
function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}年${parseInt(month ?? '0', 10)}月`;
}

/**
 * 金額を「¥1,234,567」形式の文字列に変換する。
 */
function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/**
 * MonthlySummaryTable はテナント全体の直近 3 ヶ月の月別合計金額をテーブルで表示する。
 * ルート要素は Box で、上部にセクション見出しを配置する。0 件時も見出しを表示する。
 */
export default function MonthlySummaryTable({ items }: MonthlySummaryTableProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        月別支出サマリー
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          データがありません
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="月別支出サマリー">
            <TableHead>
              <TableRow>
                <TableCell>年月</TableCell>
                <TableCell align="right">合計金額</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.yearMonth}>
                  <TableCell>{formatYearMonth(item.yearMonth)}</TableCell>
                  <TableCell align="right">{formatAmount(item.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
