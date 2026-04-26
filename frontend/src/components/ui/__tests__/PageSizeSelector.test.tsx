// PageSizeSelector のユニットテスト。
// PSS-001〜005 に対応する（issue #147）。
// 55_ui_component/common-components.md §PageSizeSelector の Props 型・動作仕様を検証する。
//
// Traceability: test_cases/reports.md §FE-6（PSS-001〜PSS-005）
// PSS-001 → 'PSS-001: test_PageSizeSelector_renders_standard_options'
// PSS-002 → 'PSS-002: test_PageSizeSelector_appends_non_standard_perPage_to_options'
// PSS-003 → 'PSS-003: test_PageSizeSelector_dedupes_when_perPage_already_in_standard'
// PSS-004 → 'PSS-004: test_PageSizeSelector_calls_onPerPageChange_with_number'
// PSS-005 → 'PSS-005: test_PageSizeSelector_disables_when_disabled_true'
//
// 実装コード（PageSizeSelector.tsx）は未存在（β2 テスト先行 PR）のため、
// tsc / vitest 実行は赤になることを想定している。CI 赤は意図的。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';

// PageSizeSelector が実装される予定のパス。
// 実装コード未存在のため import エラーが発生するが、テスト先行（β2）仕様のため許容する。
import PageSizeSelector from '../PageSizeSelector';

// 設計書（55_ui_component/common-components.md §PageSizeSelector）に基づく Props 型定義。
// 実装コードを参照せず、設計書を唯一の正本として定義する。
interface PageSizeSelectorProps {
  /** 現在の表示件数（URL クエリ per_page に対応する整数） */
  perPage: number;
  /** 標準選択肢。デフォルト [10, 20, 50, 100] */
  standardOptions?: number[];
  /** 表示件数変更時のコールバック（呼び出し側で URL 更新と page=1 リセットを行う） */
  onPerPageChange: (size: number) => void;
  /** ローディング中などで無効化 */
  disabled?: boolean;
}

describe('PageSizeSelector', () => {
  // PSS-001: perPage=20、standardOptions 省略（デフォルト [10,20,50,100]）
  // → 「表示件数:」ラベルと Select が描画され、選択肢に 10, 20, 50, 100 の 4 件が含まれる。
  //    現在値として 20 が選択されている。
  it('PSS-001: test_PageSizeSelector_renders_standard_options — デフォルト標準選択肢 [10,20,50,100] と現在値 20 が描画される', () => {
    // PSS-001
    const props: PageSizeSelectorProps = {
      perPage: 20,
      onPerPageChange: vi.fn(),
    };

    render(<PageSizeSelector {...props} />);

    // 「表示件数:」ラベルが描画されること。
    expect(screen.getByText(/表示件数/)).toBeInTheDocument();

    // Select（combobox または listbox）が存在すること。
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // 現在値が 20 であること。
    // MUI Select は aria-selected の option または combobox の textContent で検証する。
    expect(select).toHaveTextContent('20');
  });

  // PSS-002: perPage=1、standardOptions=[10,20,50,100]（URL 由来の標準外値）
  // → 選択肢が昇順で [1, 10, 20, 50, 100] の 5 件になり、現在値として 1 が選択されている。
  //    （動的選択肢挙動の保証、issue #147 採用方針 A: パターン X）
  it('PSS-002: test_PageSizeSelector_appends_non_standard_perPage_to_options — 標準外値 1 が選択肢に動的追加され昇順 [1,10,20,50,100] になる', async () => {
    // PSS-002
    const props: PageSizeSelectorProps = {
      perPage: 1,
      standardOptions: [10, 20, 50, 100],
      onPerPageChange: vi.fn(),
    };
    const user = userEvent.setup();

    render(<PageSizeSelector {...props} />);

    // Select を開いて選択肢を確認する。
    const select = screen.getByRole('combobox');
    await user.click(select);

    // 選択肢が 5 件（[1, 10, 20, 50, 100]）であること。
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);

    // 選択肢が昇順 [1, 10, 20, 50, 100] であること。
    const values = options.map((o) => Number(o.textContent));
    expect(values).toEqual([1, 10, 20, 50, 100]);

    // 現在値として 1 が選択されていること。
    expect(screen.getByRole('combobox')).toHaveTextContent('1');
  });

  // PSS-003: perPage=20、standardOptions=[10,20,50,100]（perPage が標準選択肢に含まれるケース）
  // → 選択肢は [10, 20, 50, 100] のまま 4 件で、20 が重複して追加されない。
  //    （重要リスク 1: 重複ガード Set 等で除去、MUI MenuItem key warning 回避）
  it('PSS-003: test_PageSizeSelector_dedupes_when_perPage_already_in_standard — 標準選択肢に含まれる 20 が重複追加されない', async () => {
    // PSS-003
    const props: PageSizeSelectorProps = {
      perPage: 20,
      standardOptions: [10, 20, 50, 100],
      onPerPageChange: vi.fn(),
    };
    const user = userEvent.setup();

    render(<PageSizeSelector {...props} />);

    // Select を開いて選択肢を確認する。
    const select = screen.getByRole('combobox');
    await user.click(select);

    // 選択肢が 4 件（重複なし）であること。
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);

    // 選択肢が [10, 20, 50, 100] であること（20 が重複追加されていないこと）。
    const values = options.map((o) => Number(o.textContent));
    expect(values).toEqual([10, 20, 50, 100]);
  });

  // PSS-004: perPage=20 の状態で「50」を選択
  // → onPerPageChange が数値 50（文字列 "50" ではない）で 1 回呼び出される。
  it('PSS-004: test_PageSizeSelector_calls_onPerPageChange_with_number — 「50」選択時に onPerPageChange が数値 50 で呼ばれる', async () => {
    // PSS-004
    const onPerPageChange = vi.fn();
    const props: PageSizeSelectorProps = {
      perPage: 20,
      standardOptions: [10, 20, 50, 100],
      onPerPageChange,
    };
    const user = userEvent.setup();

    render(<PageSizeSelector {...props} />);

    // Select を開く。
    const select = screen.getByRole('combobox');
    await user.click(select);

    // 「50」の選択肢をクリックする。
    const option50 = screen.getByRole('option', { name: '50' });
    await user.click(option50);

    // onPerPageChange が数値 50 で 1 回呼ばれること（文字列 "50" ではない）。
    expect(onPerPageChange).toHaveBeenCalledTimes(1);
    expect(onPerPageChange).toHaveBeenCalledWith(50);
    expect(typeof onPerPageChange.mock.calls[0][0]).toBe('number');
  });

  // PSS-005: disabled={true} を渡す
  // → Select 要素が disabled 状態になり、クリック・キーボード操作で開かない。
  it('PSS-005: test_PageSizeSelector_disables_when_disabled_true — disabled=true のとき Select が無効化される', async () => {
    // PSS-005
    const onPerPageChange = vi.fn();
    const props: PageSizeSelectorProps = {
      perPage: 20,
      disabled: true,
      onPerPageChange,
    };
    const user = userEvent.setup();

    render(<PageSizeSelector {...props} />);

    // Select（combobox）が disabled であること。
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();

    // クリックしても onPerPageChange が呼ばれないこと。
    await user.click(select);
    expect(onPerPageChange).not.toHaveBeenCalled();
  });
});
