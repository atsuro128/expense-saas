// 明細テーブルコンポーネント。
// 明細データをテーブル形式で表示する。
// SCR-RPT-004 §5 に対応する。

import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { ExpenseItemWithAttachments } from '../../api/types';

export interface ItemTableProps {
  /** 明細データ配列 */
  items: ExpenseItemWithAttachments[];
  /** 操作ボタンを表示するか（所有者 AND draft のみ） */
  canEditItems: boolean;
  /** 行クリックコールバック */
  onItemClick: (itemId: string) => void;
  /** 編集ボタン押下コールバック */
  onEditItem: (itemId: string) => void;
  /** 削除ボタン押下コールバック */
  onDeleteItem: (itemId: string) => void;
}

/**
 * ItemTable は明細データをテーブル形式で表示する。
 * 操作列（編集・削除ボタン）は canEditItems=true の場合のみ表示する。
 * 編集・削除ボタンのクリックはイベント伝播を停止し、行クリックを発火しない。
 */
export default function ItemTable({ items, canEditItems, onItemClick, onEditItem, onDeleteItem }: ItemTableProps) {
  return (
    // TableContainer で囲むことでスマホ幅でもテーブル内部のみ横スクロールし、ページ全体の幅が viewport 内に収まる（issue #137 対応）。
    <TableContainer>
      <Table size="small" data-testid="item-table">
        <TableHead>
          <TableRow>
            <TableCell>日付</TableCell>
            <TableCell>金額</TableCell>
            <TableCell>カテゴリ</TableCell>
            <TableCell>摘要</TableCell>
            <TableCell>添付数</TableCell>
            {canEditItems && <TableCell>操作</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              data-testid={`item-row-${item.id}`}
              onClick={() => onItemClick(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <TableCell>
                {/* ISO 日付文字列を YYYY/MM/DD 形式に変換する */}
                {new Date(item.expense_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </TableCell>
              <TableCell>¥{item.amount.toLocaleString()}</TableCell>
              <TableCell>{item.category.name_ja}</TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell>{item.attachments.length}</TableCell>
              {canEditItems && (
                <TableCell>
                  <Button
                    size="small"
                    variant="text"
                    onClick={(e) => {
                      // 行クリックが発火しないようにイベント伝播を停止する。
                      e.stopPropagation();
                      onEditItem(item.id);
                    }}
                  >
                    編集
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    onClick={(e) => {
                      // 行クリックが発火しないようにイベント伝播を停止する。
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                  >
                    削除
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
