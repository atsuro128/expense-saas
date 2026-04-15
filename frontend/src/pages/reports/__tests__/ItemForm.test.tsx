// ItemForm コンポーネントのユニットテスト。
// ITM-FE-026〜047 に対応する。
// ItemForm は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ItemForm from '../ItemForm';

// テスト用フィクスチャ
const mockCategories = [
  { value: 'cat-001', label: '交通費' },
  { value: 'cat-002', label: '宿泊費' },
  { value: 'cat-003', label: '食費' },
  { value: 'cat-004', label: '消耗品' },
  { value: 'cat-005', label: '通信費' },
  { value: 'cat-006', label: 'その他' },
];

const mockItem = {
  expenseDate: '2026-03-10',
  amount: 1000,
  categoryId: 'cat-001',
  description: 'タクシー代',
};

const defaultProps = {
  onSubmit: () => undefined,
  onCancel: () => undefined,
  categories: mockCategories,
  apiError: null,
  isPending: false,
};

describe('ItemForm', () => {
  // ITM-FE-026: mode='add' のとき全フィールドが入力可能な状態で表示される。
  it('ITM-FE-026: mode=add のとき全フィールド（日付・金額・カテゴリ・摘要）が入力可能な状態で表示される', () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    // 全フィールドが表示される（ITM-FE-026）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // ITM-FE-027: mode='view', defaultValues=mockItem のとき全フィールドが readonly で表示される。
  it('ITM-FE-027: mode=view, defaultValues=mockItem のとき全フィールドが readonly で表示される', () => {
    render(
      <ItemForm mode="view" {...defaultProps} defaultValues={mockItem} />,
    );

    // 全フィールドが readonly で表示される（ITM-FE-027）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // ITM-FE-028: 日付を未入力で保存ボタン押下 → バリデーションエラーが表示される（V1）。
  it('ITM-FE-028: 日付を未入力で保存押下すると「日付を入力してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    // 保存ボタン押下（ITM-FE-028）。スタブ実装のため現在は失敗する。
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    expect(screen.getByText(/日付を入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-029: 金額を未入力で保存ボタン押下 → バリデーションエラーが表示される（V2）。
  it('ITM-FE-029: 金額を未入力で保存押下すると「金額を入力してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 金額バリデーションエラー（ITM-FE-029）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/金額を入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-030: 金額に -100 を入力 → バリデーションエラーが表示される（V3）。
  it('ITM-FE-030: 金額に -100 を入力すると「正の金額を入力してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const amountInput = screen.getByLabelText(/金額/);
    await userEvent.type(amountInput, '-100');
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 負の金額バリデーションエラー（ITM-FE-030）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/正の金額を入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-031: 金額に 0 を入力 → バリデーションエラーが表示される（V3）。
  it('ITM-FE-031: 金額に 0 を入力すると「正の金額を入力してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const amountInput = screen.getByLabelText(/金額/);
    await userEvent.type(amountInput, '0');
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 0 金額バリデーションエラー（ITM-FE-031）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/正の金額を入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-032: 金額に 100.5 を入力 → 小数バリデーションエラーが表示される（V4）。
  it('ITM-FE-032: 金額に 100.5 を入力すると「円単位の整数で入力してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const amountInput = screen.getByLabelText(/金額/);
    await userEvent.type(amountInput, '100.5');
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 小数バリデーションエラー（ITM-FE-032）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/円単位の整数で入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-033: カテゴリを未選択で保存ボタン押下 → バリデーションエラーが表示される（V5）。
  it('ITM-FE-033: カテゴリを未選択で保存押下すると「カテゴリを選択してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // カテゴリバリデーションエラー（ITM-FE-033）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/カテゴリを選択してください/)).toBeInTheDocument();
  });

  // ITM-FE-034: 摘要を未入力で保存ボタン押下 → バリデーションエラーが表示される（V6）。
  it('ITM-FE-034: 摘要を未入力で保存押下すると「摘要を入力してください」エラーが表示される', async () => {
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 摘要バリデーションエラー（ITM-FE-034）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/摘要を入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-035: 摘要に 501 文字を入力 → バリデーションエラーが表示される（V7）。
  it('ITM-FE-035: 摘要に 501 文字を入力すると「摘要は500文字以内で入力してください」エラーが表示される', async () => {
    const tooLong = 'あ'.repeat(501);
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    const descInput = screen.getByLabelText(/摘要/);
    await userEvent.type(descInput, tooLong);
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 摘要文字数バリデーションエラー（ITM-FE-035）。スタブ実装のため現在は失敗する。
    expect(screen.getByText(/摘要は500文字以内で入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-036: 摘要に 500 文字を入力して保存 → バリデーションエラーが表示されない（V7 境界値）。
  it('ITM-FE-036: 摘要に 500 文字を入力すると保存できる（境界値）', async () => {
    const maxLength = 'あ'.repeat(500);
    const onSubmit = vi.fn();
    render(
      <ItemForm mode="add" {...defaultProps} onSubmit={onSubmit} />,
    );

    const descInput = screen.getByLabelText(/摘要/);
    await userEvent.type(descInput, maxLength);
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    // 500 文字は許容（ITM-FE-036）。スタブ実装のため現在は失敗する。
    expect(screen.queryByText(/摘要は500文字以内で入力してください/)).not.toBeInTheDocument();
  });

  // ITM-FE-037: 全フィールドに有効値入力して保存 → onSubmit が呼ばれる。
  it('ITM-FE-037: 全フィールドに有効値入力して保存すると onSubmit が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm mode="add" {...defaultProps} onSubmit={onSubmit} />,
    );

    // 全フィールド入力（ITM-FE-037）。バリデーションを通過させるため全フィールドに有効値を入力する。
    const dateInput = screen.getByLabelText(/日付/);
    await user.type(dateInput, '2026-03-10');
    const amountInput = screen.getByLabelText(/金額/);
    await user.type(amountInput, '1000');
    // MUI Select: ラベル「カテゴリ」に紐づく combobox をクリックして選択肢を開き「交通費」を選択する。
    const categorySelect = screen.getByLabelText(/カテゴリ/);
    await user.click(categorySelect);
    const option = await screen.findByRole('option', { name: '交通費' });
    await user.click(option);
    const descInput = screen.getByLabelText(/摘要/);
    await user.type(descInput, 'タクシー代');
    const saveButton = screen.getByRole('button', { name: /^保存する$/ });
    await user.click(saveButton);

    // onSubmit が ItemFormValues 型のデータで呼ばれる。
    expect(onSubmit).toHaveBeenCalled();
  });

  // ITM-FE-038: mode='edit', defaultValues=mockItem で金額を 2000 に変更して保存 → onSubmit が呼ばれる。
  it('ITM-FE-038: mode=edit で金額変更後に保存すると onSubmit が更新後データで呼ばれる', async () => {
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="edit"
        {...defaultProps}
        onSubmit={onSubmit}
        defaultValues={mockItem}
      />,
    );

    // 金額変更して保存（ITM-FE-038）。スタブ実装のため現在は失敗する。
    const amountInput = screen.getByLabelText(/金額/);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '2000');
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await userEvent.click(saveButton);

    expect(onSubmit).toHaveBeenCalled();
  });

  // ITM-FE-039: mode='add' のとき「保存して続けて追加」ボタンが表示される。
  it('ITM-FE-039: mode=add のとき「保存して続けて追加」ボタンが表示される', () => {
    render(
      <ItemForm mode="add" {...defaultProps} onSaveAndContinue={() => undefined} />,
    );

    // 「保存して続けて追加」ボタンが表示される（ITM-FE-039）。スタブ実装のため現在は失敗する。
    expect(screen.getByRole('button', { name: /保存して続けて追加/ })).toBeInTheDocument();
  });

  // ITM-FE-040: mode='add' で「保存して続けて追加」ボタン押下 → onSaveAndContinue が呼ばれる。
  it('ITM-FE-040: mode=add で「保存して続けて追加」押下すると onSaveAndContinue が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSaveAndContinue = vi.fn();
    render(
      <ItemForm mode="add" {...defaultProps} onSaveAndContinue={onSaveAndContinue} />,
    );

    // 「保存して続けて追加」ボタン押下（ITM-FE-040）。バリデーションを通過させるため全フィールドに有効値を入力する。
    const dateInput = screen.getByLabelText(/日付/);
    await user.type(dateInput, '2026-03-10');
    const amountInput = screen.getByLabelText(/金額/);
    await user.type(amountInput, '1000');
    // MUI Select: ラベル「カテゴリ」に紐づく combobox をクリックして選択肢を開き「交通費」を選択する。
    const categorySelect = screen.getByLabelText(/カテゴリ/);
    await user.click(categorySelect);
    const option = await screen.findByRole('option', { name: '交通費' });
    await user.click(option);
    const descInput = screen.getByLabelText(/摘要/);
    await user.type(descInput, 'タクシー代');
    const button = screen.getByRole('button', { name: /保存して続けて追加/ });
    await user.click(button);

    expect(onSaveAndContinue).toHaveBeenCalled();
  });

  // ITM-FE-041: mode='edit' のとき「保存して続けて追加」ボタンが表示されない。
  it('ITM-FE-041: mode=edit のとき「保存して続けて追加」ボタンが表示されない', () => {
    render(
      <ItemForm mode="edit" {...defaultProps} defaultValues={mockItem} />,
    );

    // 「保存して続けて追加」ボタンが表示されない（ITM-FE-041）。スタブ実装のため現在は失敗する。
    expect(screen.queryByRole('button', { name: /保存して続けて追加/ })).not.toBeInTheDocument();
  });

  // ITM-FE-042: キャンセルボタン押下で onCancel が呼ばれる。
  it('ITM-FE-042: キャンセルボタン押下で onCancel が呼ばれる', async () => {
    const onCancel = vi.fn();
    render(
      <ItemForm mode="add" {...defaultProps} onCancel={onCancel} />,
    );

    // キャンセルボタン押下（ITM-FE-042）。スタブ実装のため現在は失敗する。
    const cancelButton = screen.getByRole('button', { name: /キャンセル/ });
    await userEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // ITM-FE-043: apiError が文字列のとき FormAlert が表示される。
  it('ITM-FE-043: apiError=エラーメッセージ のとき FormAlert が severity=error で表示される', () => {
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        apiError="サーバーエラーが発生しました"
      />,
    );

    // FormAlert が表示される（ITM-FE-043）。スタブ実装のため現在は失敗する。
    expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
  });

  // ITM-FE-044: apiError=null のとき FormAlert が表示されない。
  it('ITM-FE-044: apiError=null のとき FormAlert が表示されない', () => {
    render(
      <ItemForm mode="add" {...defaultProps} apiError={null} />,
    );

    // FormAlert が表示されない（ITM-FE-044）。スタブ実装のため現在は失敗する。
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ITM-FE-045: isPending=true のとき保存ボタンが disabled になる。
  it('ITM-FE-045: isPending=true のとき保存ボタンが disabled になる', () => {
    render(
      <ItemForm mode="add" {...defaultProps} isPending={true} />,
    );

    // 保存ボタンが disabled（ITM-FE-045）。スタブ実装のため現在は失敗する。
    expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled();
  });

  // ITM-FE-046: isPending=true のとき保存ボタン押下で onSubmit が呼ばれない。
  it('ITM-FE-046: isPending=true のとき保存ボタン押下で onSubmit が呼ばれない', async () => {
    const onSubmit = vi.fn();
    render(
      <ItemForm mode="add" {...defaultProps} onSubmit={onSubmit} isPending={true} />,
    );

    // MUI Button は disabled 時に pointer-events: none を設定するため、
    // pointerEventsCheck: 0 でクリックを強制し、disabled ボタンが onSubmit を呼ばないことを検証する。
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await user.click(saveButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ITM-FE-047: categories=mockCategories（6件）のとき 6 件の選択肢が表示される。
  it('ITM-FE-047: categories=mockCategories（6件）のとき 6 件の選択肢が表示される', () => {
    render(
      <ItemForm mode="add" {...defaultProps} categories={mockCategories} />,
    );

    // カテゴリドロップダウンに 6 件の選択肢が表示される（ITM-FE-047）。スタブ実装のため現在は失敗する。
    expect(screen.getByTestId('item-form')).toBeInTheDocument();
  });

  // 098-4: mode='view' のとき全フィールド（日付・金額・摘要）が readOnly になる（案 A）。
  // disabled ではなく inputProps.readOnly で制御するため、値のコピーが可能でフォーカスも外れない。
  it('ITM-FE-098-4: mode=view のとき全フィールドが readOnly 状態になる（disabled ではない）', () => {
    render(
      <ItemForm mode="view" {...defaultProps} defaultValues={mockItem} />,
    );

    // 全フィールドが readOnly になっていることを検証する（案 A: inputProps.readOnly 方式）。
    // disabled ではないため値のコピーが可能で、フォーカス順序も通常通り。
    const dateInput = screen.getByLabelText(/日付/);
    const amountInput = screen.getByLabelText(/金額/);
    const descInput = screen.getByLabelText(/摘要/);
    expect(dateInput).not.toBeDisabled();
    expect(amountInput).not.toBeDisabled();
    expect(descInput).not.toBeDisabled();
    // readOnly 属性が設定されていることを検証する。
    expect(dateInput).toHaveAttribute('readOnly');
    expect(amountInput).toHaveAttribute('readOnly');
    expect(descInput).toHaveAttribute('readOnly');
  });

  // ITM-FE-098-7: view モードでカテゴリ Select をクリックしても listbox が開かない。
  // MUI Select の開閉制御はトップレベル readOnly prop で行われる（SelectInput.js L134/L296/L456）。
  // inputProps.readOnly だけでは SelectInput の開閉制御に効かず、クリックで開いてしまう問題の回帰テスト。
  it('ITM-FE-098-7: mode=view のときカテゴリ Select をクリックしても listbox が開かない', async () => {
    const user = userEvent.setup();
    render(
      <ItemForm mode="view" {...defaultProps} defaultValues={mockItem} />,
    );

    // カテゴリ Select のトリガー要素（combobox ロール）を取得してクリックする。
    const categorySelect = screen.getByRole('combobox');
    await user.click(categorySelect);

    // readOnly 時は MUI Select の onMouseDown が null になり、listbox が開かない。
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // ITM-FE-098-8: add/edit モードではカテゴリ Select がクリックで listbox を開く（対照ケース）。
  it('ITM-FE-098-8: mode=add のときカテゴリ Select をクリックすると listbox が開く', async () => {
    const user = userEvent.setup();
    render(
      <ItemForm mode="add" {...defaultProps} />,
    );

    // add モードではカテゴリ Select が通常通り開く。
    const categorySelect = screen.getByRole('combobox');
    await user.click(categorySelect);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
