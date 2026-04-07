// AllReportsFilterBar: テナント全レポート一覧のフィルタ条件を管理するコンポーネント。
// ステータス・期間（開始日・終了日）・申請者のフィルタ入力を提供する。
// 開始日が終了日より後の場合はバリデーションエラーを表示する。

import type { UserSummary } from '../../api/types';

/** フィルタ値の型定義。 */
export interface AllReportsFilterValues {
  /** ステータスフィルタ値（空文字は「全て」） */
  status: string;
  /** 期間（開始日）。YYYY-MM-DD 形式、または null（未指定） */
  from: string | null;
  /** 期間（終了日）。YYYY-MM-DD 形式、または null（未指定） */
  to: string | null;
  /** 申請者フィルタ値（空文字は「全て」） */
  submitterId: string;
}

/** AllReportsFilterBar コンポーネントの Props。 */
interface AllReportsFilterBarProps {
  /** 現在のフィルタ値 */
  filters: AllReportsFilterValues;
  /** フィルタ変更時のコールバック */
  onFilterChange: (filters: AllReportsFilterValues) => void;
  /** 申請者セレクトボックスの選択肢一覧 */
  members: UserSummary[];
  /** メンバー一覧のローディング状態 */
  membersLoading: boolean;
}

/**
 * AllReportsFilterBar はテナント全レポート一覧のフィルタ条件を管理するコンポーネント。
 * ステータス・期間・申請者の 4 つのフィルタ入力を提供する。
 */
export default function AllReportsFilterBar({
  filters,
  onFilterChange,
  members,
  membersLoading,
}: AllReportsFilterBarProps) {
  // 日付バリデーション: 開始日 > 終了日の場合はエラー。
  const dateError =
    filters.from && filters.to && filters.from > filters.to
      ? '開始日が終了日より後になっています'
      : null;

  return (
    <div data-testid="all-reports-filter-bar">
      {/* ステータスフィルタ */}
      <select
        aria-label="ステータス"
        value={filters.status}
        onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
      >
        <option value="">全て</option>
        <option value="draft">下書き</option>
        <option value="submitted">提出済み</option>
        <option value="approved">承認済み</option>
        <option value="rejected">却下</option>
        <option value="paid">支払済み</option>
      </select>

      {/* 期間（開始日）フィルタ */}
      <input
        type="date"
        aria-label="期間（開始日）"
        value={filters.from ?? ''}
        onChange={(e) => onFilterChange({ ...filters, from: e.target.value || null })}
      />

      {/* 期間（終了日）フィルタ */}
      <input
        type="date"
        aria-label="期間（終了日）"
        value={filters.to ?? ''}
        onChange={(e) => onFilterChange({ ...filters, to: e.target.value || null })}
      />
      {dateError && <p role="alert" data-testid="date-error">{dateError}</p>}

      {/* 申請者フィルタ */}
      <select
        aria-label="申請者"
        value={filters.submitterId}
        disabled={membersLoading}
        onChange={(e) => onFilterChange({ ...filters, submitterId: e.target.value })}
      >
        <option value="">全て</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {membersLoading && <span data-testid="members-loading">読み込み中...</span>}
    </div>
  );
}
