// レポート一覧のフィルターコンポーネント（スタブ）。
// ステータス・開始日・終了日のフィルターを提供する。
// SCR-RPT-001 に対応する。

import type { ReportStatus } from '../../api/types';

export interface ReportListFilterValues {
  status: ReportStatus | '';
  from: string;
  to: string;
}

export interface ReportListFilterProps {
  values: ReportListFilterValues;
  onFilterChange: (values: ReportListFilterValues) => void;
}

/**
 * ReportListFilter はステータス・日付範囲のフィルターを提供する。
 */
export default function ReportListFilter({ values, onFilterChange }: ReportListFilterProps) {
  return (
    <div>
      <select
        aria-label="ステータス"
        value={values.status}
        onChange={(e) =>
          onFilterChange({ ...values, status: e.target.value as ReportStatus | '' })
        }
      >
        <option value="">全て</option>
        <option value="draft">下書き</option>
        <option value="submitted">提出済み</option>
        <option value="approved">承認済み</option>
        <option value="rejected">却下</option>
        <option value="paid">支払済み</option>
      </select>
      <input
        type="date"
        aria-label="開始日フィルター"
        value={values.from}
        onChange={(e) => onFilterChange({ ...values, from: e.target.value })}
      />
      <input
        type="date"
        aria-label="終了日フィルター"
        value={values.to}
        onChange={(e) => onFilterChange({ ...values, to: e.target.value })}
      />
    </div>
  );
}
