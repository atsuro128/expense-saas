// AppSelect コンポーネントのユニットテスト。
// issue 097: outlined 切り欠きとラベル位置の整合性を検証する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppSelect from '../AppSelect';

const OPTIONS = [
  { value: 'a', label: '選択肢A' },
  { value: 'b', label: '選択肢B' },
];

describe('AppSelect', () => {
  // issue-097-1: placeholder あり・未選択時に placeholder テキストが表示される。
  it('issue-097-1: placeholder あり・未選択時に placeholder テキストが表示される', () => {
    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
        placeholder="選んでください"
      />,
    );
    // placeholder の MenuItem テキストが表示されること。
    expect(screen.getByText('選んでください')).toBeInTheDocument();
  });

  // issue-097-2: placeholder あり・選択後に選択値が表示される。
  it('issue-097-2: placeholder あり・選択後に選択値が表示される', async () => {
    let selected = '';
    const { rerender } = render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value={selected}
        onChange={(v) => {
          selected = v;
        }}
        placeholder="選んでください"
      />,
    );

    // 選択後の状態をシミュレート（value を更新して再レンダリング）。
    rerender(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value="a"
        onChange={() => undefined}
        placeholder="選んでください"
      />,
    );

    // 選択済みの値ラベルが表示されること。
    expect(screen.getByText('選択肢A')).toBeInTheDocument();
  });

  // issue-097-3: placeholder なし・未選択時は placeholder テキストが存在しない（MUI 標準挙動）。
  it('issue-097-3: placeholder なし・未選択時は placeholder テキストが存在しない', () => {
    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
      />,
    );
    // placeholder テキストが存在しないこと。
    expect(screen.queryByText('選んでください')).not.toBeInTheDocument();
  });

  // issue-097-4: placeholder あり・InputLabel に data-shrink 属性が付与される（shrink=true 相当）。
  it('issue-097-4: placeholder あり・InputLabel が shrink 状態になる', () => {
    const { container } = render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
        placeholder="選んでください"
      />,
    );
    // MUI InputLabel は shrink=true のとき data-shrink="true" 属性が付与される。
    const label = container.querySelector('label');
    expect(label).toHaveAttribute('data-shrink', 'true');
  });

  // issue-097-5: placeholder なし・InputLabel に data-shrink 属性が付与されない（MUI 標準挙動）。
  it('issue-097-5: placeholder なし・未選択時は InputLabel が非 shrink 状態になる', () => {
    const { container } = render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
      />,
    );
    // placeholder なし・未選択時は MUI デフォルト（非 shrink: data-shrink="false"）になること。
    const label = container.querySelector('label');
    expect(label).toHaveAttribute('data-shrink', 'false');
  });

  // issue-097-6: placeholder なし・値あり時は InputLabel が shrink 状態になる（MUI 標準挙動）。
  it('issue-097-6: placeholder なし・値あり時は InputLabel が shrink 状態になる', () => {
    const { container } = render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value="a"
        onChange={() => undefined}
      />,
    );
    // 値あり時は MUI がデフォルトで shrink=true にする。
    const label = container.querySelector('label');
    expect(label).toHaveAttribute('data-shrink', 'true');
  });

  // issue-097-7: onChange コールバックが選択値を渡すこと。
  it('issue-097-7: onChange が選択値を渡す', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={handleChange}
        placeholder="選んでください"
      />,
    );

    // combobox をクリックしてドロップダウンを開く。
    await user.click(screen.getByRole('combobox'));
    // 選択肢A をクリック。
    await user.click(screen.getByRole('option', { name: '選択肢A' }));
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  // issue-097-8: errorMessage が指定されたとき FormHelperText が表示される。
  it('issue-097-8: errorMessage があるとき FormHelperText が表示される', () => {
    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
        errorMessage="必須項目です"
      />,
    );
    expect(screen.getByText('必須項目です')).toBeInTheDocument();
  });

  // issue-097-9: disabled=true のとき Select が無効化される。
  it('issue-097-9: disabled=true のとき Select が無効化される', () => {
    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
        disabled
      />,
    );
    // disabled なコンボボックスが存在すること。
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-disabled', 'true');
  });

  // AppSelect-R1: codex 指摘の回帰ケース。
  // placeholder なし + { value: '' } option + 初期値 "" のとき、
  // 空文字 option のラベルが combobox 内に表示される。
  // PR #55 の displayEmpty={!!placeholder} 変更で「すべて」が消える回帰を防ぐ。
  it('AppSelect-R1: placeholder なし + { value: "" } option + 初期値 "" のとき空文字 option のラベルが表示される', () => {
    const optionsWithEmpty = [
      { value: '', label: 'すべて' },
      { value: 'a', label: 'A' },
    ];
    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={optionsWithEmpty}
        value=""
        onChange={() => undefined}
      />,
    );
    // combobox 表示部（選択中の値を表示する箇所）に「すべて」が表示されること。
    expect(screen.getByRole('combobox')).toHaveTextContent('すべて');
  });

  // AppSelect-R2: placeholder なし + { value: '' } option がない + 初期値 "" のとき、
  // combobox 内に「すべて」等の選択肢ラベルが表示されないこと。
  // issue-097 本来の意図（空文字 option がない場合は切り欠きを出さない）に対応する。
  it('AppSelect-R2: placeholder なし + { value: "" } option がない + 初期値 "" のとき combobox 内に選択肢ラベルが表示されない', () => {
    render(
      <AppSelect
        name="test"
        label="テストラベル"
        options={OPTIONS}
        value=""
        onChange={() => undefined}
      />,
    );
    // value="" かつ空文字 option がない場合（displayEmpty=false）、
    // combobox 内に OPTIONS のラベル（「選択肢A」「選択肢B」）が表示されないこと。
    // MUI はこのケースで空白文字のみの要素を描画するため、
    // テキストを持たないことを「すべて」等のラベルが存在しないで検証する。
    const combobox = screen.getByRole('combobox');
    expect(combobox).not.toHaveTextContent('選択肢A');
    expect(combobox).not.toHaveTextContent('選択肢B');
  });
});
