// AllReportsFilterBar のユニットテスト。
// TNT-FE-024〜029 に対応する。
// AppSelect / AppDatePicker 共通コンポーネントを使用した実装に対応する。

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';

// MUI X の ESM import 解決問題を回避するため、共通コンポーネントをモックする。
vi.mock('../../../components/ui/AppSelect', () => ({
  default: (props: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) => (
    <select aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} disabled={props.disabled}>
      {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
vi.mock('../../../components/ui/AppDatePicker', () => ({
  // value/onChange 型が string に統一されたことを反映する（null 不使用）。
  default: (props: { label: string; value: string; onChange: (v: string) => void; errorMessage?: string }) => (
    <div>
      <input type="date" aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  ),
}));

import AllReportsFilterBar, { type AllReportsFilterValues } from '../AllReportsFilterBar';

// デフォルトのフィルタ値。空文字は「未指定」を表す（null 不使用）。
const defaultFilters: AllReportsFilterValues = {
  status: '',
  from: '',
  to: '',
  submitterId: '',
};

// テスト用メンバー一覧。
const mockMembers = [
  { id: 'u1', name: 'User1' },
  { id: 'u2', name: 'User2' },
];

describe('AllReportsFilterBar', () => {
  let mockOnFilterChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnFilterChange = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TNT-FE-024: 4 つのフィルタ入力が描画されること。
  it('TNT-FE-024: ステータス・開始日・終了日・申請者の 4 つのフィルタ入力が描画される', () => {
    render(
      <AllReportsFilterBar
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        members={mockMembers}
        membersLoading={false}
      />
    );

    // ステータスセレクト（AppSelect モック = ネイティブ select で role="combobox"）。
    expect(screen.getByRole('combobox', { name: 'ステータス' })).toBeInTheDocument();

    // 期間（開始日）の入力（AppDatePicker モック = input[type="date"]）。
    expect(screen.getByLabelText('期間（開始日）')).toBeInTheDocument();

    // 期間（終了日）の入力。
    expect(screen.getByLabelText('期間（終了日）')).toBeInTheDocument();

    // 申請者セレクト（AppSelect モック = ネイティブ select で role="combobox"）。
    expect(screen.getByRole('combobox', { name: '申請者' })).toBeInTheDocument();
  });

  // TNT-FE-025: ステータス変更時に onFilterChange が呼ばれること。
  // AppSelect モック（ネイティブ select）は userEvent.selectOptions で操作する。
  it('TNT-FE-025: ステータスセレクトで「提出済み」を選択すると onFilterChange が呼ばれる', async () => {
    const user = userEvent.setup();

    render(
      <AllReportsFilterBar
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        members={mockMembers}
        membersLoading={false}
      />
    );

    // ネイティブ select で「提出済み」を選択する。
    await user.selectOptions(screen.getByRole('combobox', { name: 'ステータス' }), 'submitted');

    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted' })
    );
  });

  // TNT-FE-026: 申請者変更時に onFilterChange が submitterId を含む値で呼ばれること。
  it('TNT-FE-026: 申請者セレクトでメンバーを選択すると submitterId を含む値で onFilterChange が呼ばれる', async () => {
    const user = userEvent.setup();

    render(
      <AllReportsFilterBar
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        members={mockMembers}
        membersLoading={false}
      />
    );

    // ネイティブ select（申請者）で「User1」（value="u1"）を選択する。
    await user.selectOptions(screen.getByRole('combobox', { name: '申請者' }), 'u1');

    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ submitterId: 'u1' })
    );
  });

  // TNT-FE-027: 開始日変更時に onFilterChange が from を含む値で呼ばれること。
  // AppDatePicker モック（input[type="date"]）は fireEvent.change で値を設定する。
  it('TNT-FE-027: 開始日 DatePicker で「2025-01-01」を入力すると from: "2025-01-01" を含む値で onFilterChange が呼ばれる', () => {
    render(
      <AllReportsFilterBar
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        members={mockMembers}
        membersLoading={false}
      />
    );

    // input[type="date"] に fireEvent.change で値を設定する（YYYY-MM-DD 形式）。
    const fromInput = screen.getByLabelText('期間（開始日）');
    fireEvent.change(fromInput, { target: { value: '2025-01-01' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2025-01-01' })
    );
  });

  // TNT-FE-028: 開始日 > 終了日の場合、バリデーションエラーが表示されること。
  // バリデーション文言: 「開始日は終了日以前を指定してください」（50_detail_design/screens 準拠）。
  it('TNT-FE-028: 開始日が終了日より後の場合、DatePicker にバリデーションエラーが表示される', () => {
    render(
      <AllReportsFilterBar
        filters={{ ...defaultFilters, from: '2025-12-31', to: '2025-01-01' }}
        onFilterChange={mockOnFilterChange}
        members={mockMembers}
        membersLoading={false}
      />
    );

    // バリデーションエラーが表示されること。
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('date-error')).toBeInTheDocument();
    // 文言が設計書準拠であること。
    expect(screen.getByText('開始日は終了日以前を指定してください')).toBeInTheDocument();
  });

  // TNT-FE-029: membersLoading = true の場合、申請者セレクトが disabled になること。
  it('TNT-FE-029: membersLoading = true のとき申請者セレクトが disabled になる', () => {
    render(
      <AllReportsFilterBar
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        members={[]}
        membersLoading={true}
      />
    );

    // ネイティブ select は HTML disabled 属性が付くため toBeDisabled() で検証する。
    expect(screen.getByRole('combobox', { name: '申請者' })).toBeDisabled();
  });

  // REGRESSION-AllReportsFilterBar-1: codex 指摘の回帰防止テスト。
  // 初期状態（status=''）で「全て」オプションがステータスフィルタ内に表示されること。
  // AppSelect の displayEmpty 条件が誤った場合に空欄になる回帰を検出する。
  it('REGRESSION-AllReportsFilterBar-1: フィルタ初期状態でステータスセレクトに「全て」が表示される', () => {
    render(
      <AllReportsFilterBar
        filters={defaultFilters}
        onFilterChange={mockOnFilterChange}
        members={mockMembers}
        membersLoading={false}
      />
    );

    // ステータスセレクトの初期値（value=""）に対応する「全て」オプションが
    // combobox 内の選択済み option として描画されていること。
    // モック実装（ネイティブ select）では選択肢として option が存在することを確認する。
    const statusSelect = screen.getByRole('combobox', { name: 'ステータス' });
    expect(statusSelect).toBeInTheDocument();
    // value="" の option「全て」が select 内に存在すること。
    const allOption = statusSelect.querySelector('option[value=""]');
    expect(allOption).toBeInTheDocument();
    expect(allOption).toHaveTextContent('全て');
  });
});
