// レポート一覧ページ。
// report-list.md §ReportListPage 準拠の最小構造。
// Step 10 で本実装に置き換える。

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useMyReports } from '../hooks/useReports';

// ステータス選択肢の定義。
const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'submitted', label: '申請中' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '却下' },
  { value: 'paid', label: '支払済み' },
];

/**
 * StatusSelect はフィルタ用のカスタムドロップダウンコンポーネント。
 * - data-testid="report-list-filter-status" の要素が toHaveValue を満たす（hidden input）。
 * - クリックでドロップダウンが開き、role="option" の要素が描画される。
 * - option をクリックすると onChange が発火する。
 */
interface StatusSelectProps {
  value: string;
  onChange: (value: string) => void;
}

function StatusSelect({ value, onChange }: StatusSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // コンテナ外クリックでドロップダウンを閉じる。
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const currentLabel = STATUS_OPTIONS.find((opt) => opt.value === value)?.label ?? 'すべて';

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/*
        トリガーボタンに data-testid と value を設定する。
        button 要素は value DOM プロパティを持つため toHaveValue が機能する。
        クリックでドロップダウンを開閉する。
      */}
      <button
        data-testid="report-list-filter-status"
        type="button"
        value={value}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{ minWidth: 120, padding: '4px 8px', cursor: 'pointer' }}
      >
        {currentLabel}
      </button>
      {/* ドロップダウンリスト */}
      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            minWidth: 120,
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => handleSelect(opt.value)}
              style={{ padding: '4px 8px', cursor: 'pointer' }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * ReportListPage はレポート一覧画面のルートコンポーネント。
 * URL クエリパラメータからフィルタ条件を復元し useMyReports でデータ取得する。
 */
export default function ReportListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータからフィルタ条件を復元する。
  const currentStatus = searchParams.get('status') ?? '';
  const currentFrom = searchParams.get('from') ?? '';
  const currentTo = searchParams.get('to') ?? '';
  const currentPage = Number(searchParams.get('page') ?? '1');

  const { data, isLoading, isError, error } = useMyReports({
    page: currentPage,
    status: currentStatus || undefined,
    from: currentFrom || undefined,
    to: currentTo || undefined,
  });

  // エラー時はトーストを表示する。
  if (isError) {
    return (
      <div
        data-testid="app-toast"
        data-severity="error"
        aria-live="assertive"
      >
        {error instanceof Error ? error.message : 'エラーが発生しました'}
      </div>
    );
  }

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return (
      <div data-testid="page-skeleton" data-variant="table" />
    );
  }

  const reports = data?.data ?? [];
  const pagination = data?.pagination;

  // ステータスフィルタ変更時に URL クエリパラメータを更新し page を 1 にリセットする。
  const handleStatusChange = (newStatus: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('status', newStatus);
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = new URLSearchParams(searchParams);
    next.set('from', event.target.value);
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = new URLSearchParams(searchParams);
    next.set('to', event.target.value);
    next.set('page', '1');
    setSearchParams(next);
  };

  // ページ変更時に URL クエリパラメータを更新する。
  const handlePageChange = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
  };

  return (
    <Box>
      {/* ヘッダー: タイトルとレポート作成ボタン */}
      <Box data-testid="report-list-header" sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <span>マイレポート</span>
        <Button
          data-testid="create-report-button"
          variant="contained"
          onClick={() => navigate('/reports/new')}
        >
          + レポート作成
        </Button>
      </Box>

      {/* フィルタ */}
      <Box data-testid="report-list-filter" sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {/*
          StatusSelect はカスタムドロップダウン。
          hidden input（data-testid="report-list-filter-status"）で toHaveValue に対応し、
          role="option" の li をクリックすることで onChange が発火する。
        */}
        <StatusSelect value={currentStatus} onChange={handleStatusChange} />
        <input
          data-testid="report-list-filter-from"
          type="date"
          value={currentFrom}
          onChange={handleFromChange}
        />
        <input
          data-testid="report-list-filter-to"
          type="date"
          value={currentTo}
          onChange={handleToChange}
        />
      </Box>

      {/* テーブル */}
      <Box data-testid="report-list-table" component="table" sx={{ width: '100%' }}>
        <thead>
          <tr>
            <th>タイトル</th>
            <th>期間</th>
            <th>ステータス</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr
              key={report.id}
              data-testid={`report-row-${report.id}`}
              onClick={() => navigate(`/reports/${report.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <td>{report.title}</td>
              <td>{report.period_start} 〜 {report.period_end}</td>
              <td>{report.status}</td>
              <td>{report.total_amount}</td>
            </tr>
          ))}
        </tbody>
      </Box>

      {/* ページネーション */}
      <Box data-testid="app-pagination" sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        {pagination && pagination.total_pages > 1 && (
          <Box>
            {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === pagination.current_page ? 'contained' : 'outlined'}
                onClick={() => handlePageChange(page)}
                sx={{ mx: 0.5 }}
              >
                {page}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
