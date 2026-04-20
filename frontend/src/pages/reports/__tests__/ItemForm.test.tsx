// ItemForm コンポーネントのユニットテスト。
// ITM-FE-026〜047 に対応する。
// ItemForm は未実装（スタブ）のため、テストは失敗する（赤い仕様テスト）。

import { render, screen, waitFor, within } from '@testing-library/react';
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

  // --- ITM-FE-099〜106: 期間外警告（ITM-007、ConfirmDialog）---
  // 判定条件: expenseDate < reportPeriodStart || expenseDate > reportPeriodEnd（strict less/greater）
  // 確認ボタン押下 → 保存処理継続、キャンセル押下 → ダイアログ閉じて保存せず（入力値維持）
  // View モードでは ConfirmDialog を表示しない

  // 期間外警告テスト共通のヘルパー: 全フィールドに有効値を入力して保存ボタンを押下する。
  // expenseDate は引数で指定する。
  async function fillFormAndSave(
    user: ReturnType<typeof userEvent.setup>,
    expenseDateValue: string,
  ): Promise<void> {
    const dateInput = screen.getByLabelText(/日付/);
    await user.clear(dateInput);
    await user.type(dateInput, expenseDateValue);
    const amountInput = screen.getByLabelText(/金額/);
    await user.clear(amountInput);
    await user.type(amountInput, '1000');
    // カテゴリ Select: combobox をクリックして選択肢を開き「交通費」を選択する。
    const categorySelect = screen.getByLabelText(/カテゴリ/);
    await user.click(categorySelect);
    const option = await screen.findByRole('option', { name: '交通費' });
    await user.click(option);
    const descInput = screen.getByLabelText(/摘要/);
    await user.clear(descInput);
    await user.type(descInput, 'タクシー代');
    const saveButton = screen.getByRole('button', { name: /^保存する$/ });
    await user.click(saveButton);
  }

  // ITM-FE-099: 期間開始日より前の日付で保存 → ConfirmDialog 表示・onSubmit 未呼び出し。
  it('ITM-FE-099: 期間開始日より前の日付で保存するとConfirmDialogが表示されonSubmitは呼ばれない', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // expenseDate='2026-03-15'（開始日 2026-04-01 より前）で全フィールド入力後、保存ボタン押下。
    await fillFormAndSave(user, '2026-03-15');

    // ConfirmDialog が表示されることを検証する（ITM-FE-099）。機能未実装のため現在は失敗する。
    expect(
      screen.getByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).toBeInTheDocument();
    // onSubmit は ConfirmDialog の確認前には呼ばれないことを検証する。
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ITM-FE-100: 期間終了日より後の日付（edit モード）→ ConfirmDialog 表示・onSubmit 未呼び出し。
  it('ITM-FE-100: 期間終了日より後の日付（editモード）で保存するとConfirmDialogが表示される', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="edit"
        {...defaultProps}
        onSubmit={onSubmit}
        defaultValues={mockItem}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // expenseDate を '2026-05-05'（終了日 2026-04-30 より後）に変更して保存ボタン押下。
    const dateInput = screen.getByLabelText(/日付/);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-05-05');
    const saveButton = screen.getByRole('button', { name: /^保存する$/ });
    await user.click(saveButton);

    // ConfirmDialog が表示されることを検証する（ITM-FE-100）。機能未実装のため現在は失敗する。
    expect(
      screen.getByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).toBeInTheDocument();
    // onSubmit は ConfirmDialog の確認前には呼ばれないことを検証する。
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ITM-FE-101: ConfirmDialog 確認ボタン押下 → onSubmit が呼ばれ ConfirmDialog が閉じる。
  it('ITM-FE-101: ConfirmDialog確認ボタン押下でonSubmitが呼ばれConfirmDialogが閉じる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // 期間外日付で保存して ConfirmDialog を表示させる。
    await fillFormAndSave(user, '2026-03-15');

    // ConfirmDialog タイトルを確認してから確認ボタンを押下する（ITM-FE-101）。機能未実装のため現在は失敗する。
    expect(screen.getByText('入力内容の確認')).toBeInTheDocument();
    // ConfirmDialog 内の「保存する」ボタン（confirm）を押下する。
    // ページ上に「保存する」ボタンが複数ある場合を考慮してダイアログ内を絞り込む。
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: '保存する' });
    await user.click(confirmButton);

    // onSubmit が期間外の入力値を含む ItemFormValues で呼ばれることを検証する。
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // ConfirmDialog が閉じることを検証する（MUI Dialog の exit アニメーション完了を待つ）。
    await waitFor(() => {
      expect(
        screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
      ).not.toBeInTheDocument();
    });
  });

  // ITM-FE-102: ConfirmDialog キャンセルボタン押下 → onSubmit 未呼び出し・フォーム入力値維持。
  it('ITM-FE-102: ConfirmDialogキャンセルボタン押下でonSubmitが呼ばれずフォーム入力値が維持される', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // 期間外日付で保存して ConfirmDialog を表示させる。
    await fillFormAndSave(user, '2026-03-15');

    // ConfirmDialog の「キャンセル」ボタンを押下する（ITM-FE-102）。機能未実装のため現在は失敗する。
    const dialog = screen.getByRole('dialog');
    const cancelButton = within(dialog).getByRole('button', { name: 'キャンセル' });
    await user.click(cancelButton);

    // onSubmit が呼ばれないことを検証する。
    expect(onSubmit).not.toHaveBeenCalled();
    // ConfirmDialog が閉じることを検証する（MUI Dialog の exit アニメーション完了を待つ）。
    await waitFor(() => {
      expect(
        screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
      ).not.toBeInTheDocument();
    });
    // フォームの入力値が維持されていることを検証する（expenseDate='2026-03-15'）。
    const dateInput = screen.getByLabelText(/日付/);
    expect(dateInput).toHaveValue('2026-03-15');
  });

  // ITM-FE-103: 期間内の日付 → ConfirmDialog 非表示・onSubmit 即時呼び出し。
  it('ITM-FE-103: 期間内の日付で保存するとConfirmDialogは表示されずonSubmitが即座に呼ばれる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // expenseDate='2026-04-15'（期間内）で全フィールド入力後、保存ボタン押下。
    await fillFormAndSave(user, '2026-04-15');

    // ConfirmDialog が表示されないことを検証する（ITM-FE-103）。機能未実装のため現在は失敗する。
    expect(
      screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).not.toBeInTheDocument();
    // onSubmit が即座に呼ばれることを検証する。
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // ITM-FE-104: 境界値（開始日/終了日ちょうど）→ 期間内扱いで ConfirmDialog 非表示・onSubmit 呼び出し。
  it('ITM-FE-104（開始日境界値）: 期間開始日ちょうどの日付で保存するとConfirmDialogは表示されずonSubmitが呼ばれる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // expenseDate='2026-04-01'（開始日ちょうど）で保存ボタン押下。
    await fillFormAndSave(user, '2026-04-01');

    // ConfirmDialog が表示されないことを検証する（境界値は期間内扱い、ITM-FE-104）。機能未実装のため現在は失敗する。
    expect(
      screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('ITM-FE-104（終了日境界値）: 期間終了日ちょうどの日付で保存するとConfirmDialogは表示されずonSubmitが呼ばれる', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // expenseDate='2026-04-30'（終了日ちょうど）で保存ボタン押下。
    await fillFormAndSave(user, '2026-04-30');

    // ConfirmDialog が表示されないことを検証する（境界値は期間内扱い、ITM-FE-104）。機能未実装のため現在は失敗する。
    expect(
      screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // ITM-FE-104（RFC3339 境界値・防御コード検証）:
  // API が period_start / period_end を RFC3339（2026-04-01T00:00:00Z）で返す
  // ケース（issue 117）でも、ItemForm 内の正規化（.slice(0, 10)）により
  // 開始日ちょうどの expenseDate が期間内として扱われることを検証する。
  it('ITM-FE-104（RFC3339 境界値）: period_start が RFC3339 形式でも開始日ちょうどは期間内扱い', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSubmit={onSubmit}
        reportPeriodStart="2026-04-01T00:00:00Z"
        reportPeriodEnd="2026-04-30T00:00:00Z"
      />,
    );

    // expenseDate='2026-04-01'（開始日ちょうど、YYYY-MM-DD）で保存ボタン押下。
    await fillFormAndSave(user, '2026-04-01');

    // 正規化されていない場合は '2026-04-01' < '2026-04-01T00:00:00Z' が true になり
    // 誤警告が出るが、isOutsidePeriod 内の .slice(0, 10) により期間内扱いになることを検証する。
    expect(
      screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // ITM-FE-105: 「保存して続けて追加」ボタンでも ConfirmDialog が機能する。
  it('ITM-FE-105: 保存して続けて追加ボタンでも期間外日付はConfirmDialogが表示されonSaveAndContinueは呼ばれない', async () => {
    const user = userEvent.setup();
    const onSaveAndContinue = vi.fn();
    render(
      <ItemForm
        mode="add"
        {...defaultProps}
        onSaveAndContinue={onSaveAndContinue}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // 全フィールドに有効値を入力して「保存して続けて追加」ボタンを押下する。
    const dateInput = screen.getByLabelText(/日付/);
    await user.type(dateInput, '2026-03-15');
    const amountInput = screen.getByLabelText(/金額/);
    await user.type(amountInput, '1000');
    // カテゴリ Select: combobox をクリックして選択肢を開き「交通費」を選択する。
    const categorySelect = screen.getByLabelText(/カテゴリ/);
    await user.click(categorySelect);
    const option = await screen.findByRole('option', { name: '交通費' });
    await user.click(option);
    const descInput = screen.getByLabelText(/摘要/);
    await user.type(descInput, 'タクシー代');
    const saveAndContinueButton = screen.getByRole('button', { name: /保存して続けて追加/ });
    await user.click(saveAndContinueButton);

    // ConfirmDialog が表示されることを検証する（ITM-FE-105）。機能未実装のため現在は失敗する。
    expect(
      screen.getByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).toBeInTheDocument();
    // onSaveAndContinue は ConfirmDialog の確認前には呼ばれないことを検証する。
    expect(onSaveAndContinue).not.toHaveBeenCalled();

    // ConfirmDialog の確認ボタン押下後に onSaveAndContinue が呼ばれることを検証する。
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: '保存する' });
    await user.click(confirmButton);
    expect(onSaveAndContinue).toHaveBeenCalledTimes(1);
  });

  // ITM-FE-106: View モードでは ConfirmDialog が表示されない。
  it('ITM-FE-106: viewモードでは期間外日付でもConfirmDialogは表示されない', () => {
    render(
      <ItemForm
        mode="view"
        {...defaultProps}
        defaultValues={{ ...mockItem, expenseDate: '2026-03-15' }}
        reportPeriodStart="2026-04-01"
        reportPeriodEnd="2026-04-30"
      />,
    );

    // view モードでは保存操作が存在しないため、ConfirmDialog は表示されない（ITM-FE-106）。
    // 期間外日付がデフォルト値として設定されていても ConfirmDialog は非表示であることを検証する。
    expect(
      screen.queryByText('明細日付がレポートの対象期間外です。入力を確認してください。'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // --- onBlur リアルタイムバリデーションテスト（issue 118）---
  // mode: 'onBlur' / reValidateMode: 'onChange' 設定により、
  // フィールドからフォーカスが外れた時点でエラーが表示されることを検証する（V1〜V7）。

  // onBlur-1: 金額に 0 を入力 → blur → 「正の金額を入力してください」表示（V3）。
  it('onBlur-1: 金額に 0 を入力してblurすると「正の金額を入力してください」エラーが即時表示される（V3）', async () => {
    const user = userEvent.setup();
    render(<ItemForm mode="add" {...defaultProps} />);

    const amountInput = screen.getByLabelText(/金額/);
    await user.type(amountInput, '0');
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/正の金額を入力してください/)).toBeInTheDocument();
  });

  // onBlur-2: 金額に -1 を入力 → blur → 「正の金額を入力してください」表示（V3）。
  it('onBlur-2: 金額に -1 を入力してblurすると「正の金額を入力してください」エラーが即時表示される（V3）', async () => {
    const user = userEvent.setup();
    render(<ItemForm mode="add" {...defaultProps} />);

    const amountInput = screen.getByLabelText(/金額/);
    await user.type(amountInput, '-1');
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/正の金額を入力してください/)).toBeInTheDocument();
  });

  // onBlur-3: 金額に 1.5 を入力 → blur → 「円単位の整数で入力してください」表示（V4）。
  it('onBlur-3: 金額に 1.5 を入力してblurすると「円単位の整数で入力してください」エラーが即時表示される（V4）', async () => {
    const user = userEvent.setup();
    render(<ItemForm mode="add" {...defaultProps} />);

    const amountInput = screen.getByLabelText(/金額/);
    await user.type(amountInput, '1.5');
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/円単位の整数で入力してください/)).toBeInTheDocument();
  });

  // onBlur-4: 日付フィールドをフォーカス → blur（未入力）→ 「日付を入力してください」表示（V1）。
  it('onBlur-4: 日付を未入力のままblurすると「日付を入力してください」エラーが即時表示される（V1）', async () => {
    const user = userEvent.setup();
    render(<ItemForm mode="add" {...defaultProps} />);

    const dateInput = screen.getByLabelText(/日付/);
    await user.click(dateInput); // フォーカス
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/日付を入力してください/)).toBeInTheDocument();
  });

  // ITM-FE-108: 金額フィールドを空のままフォーカスアウトすると「金額を入力してください」エラー表示（V2）。
  it('ITM-FE-108: shows_validation_error_when_amount_empty_on_blur: 金額フィールドを空のままフォーカスアウトすると「金額を入力してください」がエラー表示される（V2）', async () => {
    const user = userEvent.setup();
    render(<ItemForm mode="add" {...defaultProps} />);

    const amountInput = screen.getByLabelText(/金額/);
    // 既存入力がある場合は空にクリアし、未入力のままフォーカスアウトする。
    await user.clear(amountInput);
    await user.click(amountInput); // フォーカス
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/金額を入力してください/)).toBeInTheDocument();
  });

  // onBlur-6: 摘要を未入力のまま blur → 「摘要を入力してください」表示（V6）。
  it('onBlur-6: 摘要を未入力のままblurすると「摘要を入力してください」エラーが即時表示される（V6）', async () => {
    const user = userEvent.setup();
    render(<ItemForm mode="add" {...defaultProps} />);

    const descInput = screen.getByLabelText(/摘要/);
    await user.click(descInput); // フォーカス
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/摘要を入力してください/)).toBeInTheDocument();
  });

  // onBlur-7: 摘要に 501 文字を入力 → blur → 「摘要は500文字以内で入力してください」表示（V7）。
  it('onBlur-7: 摘要に501文字入力してblurすると「摘要は500文字以内で入力してください」エラーが即時表示される（V7）', async () => {
    const user = userEvent.setup();
    const tooLong = 'あ'.repeat(501);
    render(<ItemForm mode="add" {...defaultProps} />);

    const descInput = screen.getByLabelText(/摘要/);
    await user.type(descInput, tooLong);
    await user.tab(); // blur を発火させる

    expect(screen.getByText(/摘要は500文字以内で入力してください/)).toBeInTheDocument();
  });
});
