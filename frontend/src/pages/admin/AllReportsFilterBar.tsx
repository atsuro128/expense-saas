// AllReportsFilterBar: テナント全レポート一覧のフィルタ条件を管理するコンポーネント。
// ステータス・期間（開始日・終了日）・申請者のフィルタ入力を提供する。
// 開始日が終了日より後の場合はバリデーションエラーを表示する。
// 共通コンポーネント AppSelect / AppDatePicker を使用する。
// 55_ui_component/screens/admin-all-reports.md §AllReportsFilterBar 参照。

import AppSelect from '../../components/ui/AppSelect';
import AppDatePicker from '../../components/ui/AppDatePicker';
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

/** ステータスフィルタの選択肢。 */
const STATUS_OPTIONS = [
  { value: '', label: '全て' },
  { value: 'draft', label: '下書き' },
  { value: 'submitted', label: '提出済み' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '却下' },
  { value: 'paid', label: '支払済み' },
];

/**
 * AllReportsFilterBar はテナント全レポート一覧のフィルタ条件を管理するコンポーネント。
 * ステータス・期間・申請者の 4 つのフィルタ入力を提供する。
 * AppSelect / AppDatePicker 共通コンポーネントを使用する。
 */
export default function AllReportsFilterBar({
  filters,
  onFilterChange,
  members,
  membersLoading,
}: AllReportsFilterBarProps) {
  // 日付バリデーション: 開始日 > 終了日の場合はエラー。
  // 50_detail_design/screens/admin-all-reports.md §5 バリデーション文言準拠。
  const dateError =
    filters.from && filters.to && filters.from > filters.to
      ? '開始日は終了日以前を指定してください'
      : undefined;

  // 申請者セレクトの選択肢を生成する。
  const memberOptions = [
    { value: '', label: '全て' },
    ...members.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <div data-testid="all-reports-filter-bar">
      {/* ステータスフィルタ */}
      <AppSelect
        name="status"
        label="ステータス"
        options={STATUS_OPTIONS}
        value={filters.status}
        onChange={(value) => onFilterChange({ ...filters, status: value })}
      />

      {/* 期間（開始日）フィルタ */}
      <AppDatePicker
        name="from"
        label="期間（開始日）"
        value={filters.from}
        onChange={(value) => onFilterChange({ ...filters, from: value })}
      />

      {/* 期間（終了日）フィルタ。バリデーションエラーをフィールド直下に表示する。 */}
      <AppDatePicker
        name="to"
        label="期間（終了日）"
        value={filters.to}
        onChange={(value) => onFilterChange({ ...filters, to: value })}
        errorMessage={dateError}
      />
      {dateError && (
        <p role="alert" data-testid="date-error">
          {dateError}
        </p>
      )}

      {/* 申請者フィルタ */}
      <AppSelect
        name="submitterId"
        label="申請者"
        options={memberOptions}
        value={filters.submitterId}
        onChange={(value) => onFilterChange({ ...filters, submitterId: value })}
        disabled={membersLoading}
      />
      {membersLoading && <span data-testid="members-loading">読み込み中...</span>}
    </div>
  );
}
