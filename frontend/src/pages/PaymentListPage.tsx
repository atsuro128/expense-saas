// 支払待ちレポート一覧ページ（PaymentListPage）。
// SCR-WFL-002 に対応する。
// Accounting ロールのユーザーが支払待ちのレポートを一覧表示する。

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppToast from '../components/ui/AppToast';
import PageSkeleton from '../components/ui/PageSkeleton';
import FilterResetButton from '../components/ui/FilterResetButton';
import SelfLabel from '../components/ui/SelfLabel';
import { usePayableReports } from '../hooks/useReports';

/**
 * 簡易ページネーションコンポーネント（data-testid 付きボタン）。
 */
function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div data-testid="app-pagination">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          data-testid={`pagination-page-${page}`}
          onClick={() => onPageChange(page)}
          disabled={page === currentPage}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
    </div>
  );
}

/**
 * PaymentListPage は支払待ちレポートの一覧を表示する画面。
 * 403 エラー時はダッシュボードにリダイレクトする。
 * 500 エラー時は AppToast でエラーを表示する。
 */
export default function PaymentListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL クエリパラメータからフィルタ初期値を取得する。
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const applicantNameParam = searchParams.get('applicant_name') ?? '';

  // 申請者名フィルタの入力値（デバウンス前）。
  const [applicantNameInput, setApplicantNameInput] = useState(applicantNameParam);

  // デバウンスされたフィルタ値（300ms 後に URL に反映）。
  const [debouncedApplicantName, setDebouncedApplicantName] = useState(applicantNameParam);

  // トーストの表示状態。
  const [toastOpen, setToastOpen] = useState(false);

  // 入力値のデバウンス処理（300ms 遅延）。
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedApplicantName(applicantNameInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [applicantNameInput]);

  // デバウンス後の値が変わったら URL パラメータを更新する。
  const handleApplicantNameChange = useCallback((value: string) => {
    setApplicantNameInput(value);
  }, []);

  // URL への反映はデバウンス後の値が変わったタイミングで行う。
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', '1');
    if (debouncedApplicantName) {
      next.set('applicant_name', debouncedApplicantName);
    } else {
      next.delete('applicant_name');
    }
    setSearchParams(next, { replace: true });
    // searchParams を依存に含めると無限ループするため意図的に除外する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedApplicantName]);

  // ページ変更ハンドラ。
  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(newPage));
    setSearchParams(next);
  };

  // フィルタリセットハンドラ。
  const handleFilterReset = () => {
    setApplicantNameInput('');
    setDebouncedApplicantName('');
    const next = new URLSearchParams();
    setSearchParams(next);
  };

  // フィルタが適用されているかどうか。
  const isFiltered = !!applicantNameParam;

  // 支払待ちレポート一覧データを取得する。
  const { data, isLoading, isError, error } = usePayableReports({
    page,
    applicant_name: applicantNameParam || undefined,
  });

  // 403 エラー時はダッシュボードにリダイレクトする。
  useEffect(() => {
    if (isError && error && (error as { status?: number }).status === 403) {
      void navigate('/dashboard');
    }
  }, [isError, error, navigate]);

  // 500 エラー（非 403）時はトーストを表示する。
  useEffect(() => {
    if (isError && error && (error as { status?: number }).status !== 403) {
      setToastOpen(true);
    }
  }, [isError, error]);

  const reports = data?.data ?? [];
  const pagination = data?.pagination;
  const totalCount = pagination?.total_count ?? 0;
  const totalPages = pagination?.total_pages ?? 1;

  // ローディング中はスケルトンを表示する。
  if (isLoading) {
    return (
      <div data-testid="payable-reports-page">
        <PageSkeleton variant="table" />
      </div>
    );
  }

  return (
    <div data-testid="payable-reports-page">
      {/* ページタイトル */}
      <div>
        <h1>支払待ち一覧</h1>
      </div>

      {/* フィルタ */}
      <div>
        <input
          data-testid="payable-filter-applicant-name"
          type="text"
          value={applicantNameInput}
          onChange={(e) => handleApplicantNameChange(e.target.value)}
          placeholder="申請者名で絞り込み"
          aria-label="申請者名フィルタ"
        />
        <FilterResetButton onReset={handleFilterReset} isFiltered={isFiltered} />
      </div>

      {/* 空状態 */}
      {!isLoading && reports.length === 0 && (
        <div>
          {isFiltered ? (
            <p>条件に一致するレポートはありません。</p>
          ) : (
            <p>支払待ちのレポートはありません。</p>
          )}
        </div>
      )}

      {/* テーブル */}
      {!isLoading && reports.length > 0 && (
        <>
          <p>{totalCount} 件の支払待ちレポート</p>
          <table data-testid="payable-report-table">
            <thead>
              <tr>
                <th>申請者</th>
                <th>タイトル</th>
                <th>金額</th>
                <th data-testid="payable-table-header-approved-at">承認日</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr
                  key={report.id}
                  data-testid={`payable-report-row-${report.id}`}
                  onClick={() => void navigate(`/reports/${report.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    {report.submitter?.name ?? ''}
                    <SelfLabel isOwnReport={report.is_own_report ?? false} />
                  </td>
                  <td>{report.title}</td>
                  <td>{report.total_amount.toLocaleString()}</td>
                  <td>{report.approved_at ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* ページネーション */}
          <SimplePagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {/* エラートースト */}
      <AppToast
        open={toastOpen}
        severity="error"
        message="サーバーエラーが発生しました"
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
