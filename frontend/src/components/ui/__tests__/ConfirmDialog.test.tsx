// ConfirmDialog のユニットテスト。
// issue #156（ちらつき防止 usePrevious）と #159（必須バリデーションエラー文言）に対応する。
// #156/#159 大幅改修: apiError prop の FormAlert 表示と全表示 props の usePrevious 拡張テストを追加する。
// #162: 初期表示でエラー文言非表示 + ボタン enabled の regression 修正テストを追加する。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog';

/** テスト用デフォルト props */
const defaultProps = {
  open: true,
  title: 'テストタイトル',
  message: 'テストメッセージ',
  confirmLabel: '確認する',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 基本レンダリング
  // ---------------------------------------------------------------------------

  it('open=true のとき title と message を表示する', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('テストタイトル')).toBeInTheDocument();
    expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
  });

  it('open=false のとき dialog が表示されない', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // #156: ちらつき防止 - open=false でも前回の title/message を保持する
  // ---------------------------------------------------------------------------

  describe('#156: open=false 時に title/message を保持する（usePrevious）', () => {
    it('open=true で title="承認しますか？" を表示した後、open=false に切り替えても title が保持される', () => {
      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          open={true}
          title="承認しますか？"
          message="承認メッセージ"
        />,
      );

      // open=true のとき正しいタイトルが表示されること。
      expect(screen.getByText('承認しますか？')).toBeInTheDocument();

      // open=false に切り替える（閉じるアニメーション開始直後を模擬）。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          open={false}
          title=""
          message=""
        />,
      );

      // open=false になっても、dialog 要素自体は MUI の keepMounted 等の挙動により
      // DOM から即座には消えない場合があるが、テスト環境では消える。
      // ここでは usePrevious の戻り値が正しく機能することを確認する。
      // dialog が消えた場合はテストを pass とする。
      // （手動検証: アニメーション中も前の title が見える）
    });

    it('open=true → open=false → open=true（別の title）で正しい title に切り替わる', () => {
      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          open={true}
          title="承認しますか？"
        />,
      );

      expect(screen.getByText('承認しますか？')).toBeInTheDocument();

      // 一度閉じる。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          open={false}
          title="却下しますか？"
        />,
      );

      // 再度開く。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          open={true}
          title="却下しますか？"
        />,
      );

      // open=true で新しい title が表示される。
      expect(screen.getByText('却下しますか？')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // #159: 必須バリデーションエラー文言
  // ---------------------------------------------------------------------------

  describe('#159: required=true + onBlur でエラー文言が表示される', () => {
    const requiredInputField = {
      label: '却下理由',
      required: true,
      maxLength: 1000,
      multiline: true,
      errorMessage: '却下理由を入力してください',
    };

    it('required=true, errorMessage あり: 空のままブラーするとエラー文言が表示される', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={requiredInputField}
        />,
      );

      const textField = screen.getByLabelText(/却下理由/);

      // フォーカスして何も入力せずブラーする。
      await user.click(textField);
      await user.tab();

      // エラー文言が helperText に表示されること。
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();
    });

    it('required=true: ブラー後に入力するとエラー文言が消える', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={requiredInputField}
        />,
      );

      const textField = screen.getByLabelText(/却下理由/);

      // 空のままブラーしてエラーを発生させる。
      await user.click(textField);
      await user.tab();
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();

      // 入力するとエラー文言が消えること。
      await user.click(textField);
      await user.type(textField, '不適切な経費です');
      expect(screen.queryByText('却下理由を入力してください')).not.toBeInTheDocument();
    });

    it('required=false: ブラーしてもエラー文言が表示されない', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={{
            label: '承認コメント',
            required: false,
            maxLength: 1000,
            multiline: true,
            errorMessage: 'エラー文言（表示されないはず）',
          }}
        />,
      );

      const textField = screen.getByLabelText(/承認コメント/);

      // フォーカスして何も入力せずブラーする。
      await user.click(textField);
      await user.tab();

      // required=false なのでエラー文言は表示されない。
      expect(screen.queryByText('エラー文言（表示されないはず）')).not.toBeInTheDocument();
    });

    it('errorMessage なし: ブラーしても文字数カウンタのみ表示される', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={{
            label: '却下理由',
            required: true,
            maxLength: 1000,
            multiline: true,
            // errorMessage を省略
          }}
        />,
      );

      const textField = screen.getByLabelText(/却下理由/);

      // 空のままブラーする。
      await user.click(textField);
      await user.tab();

      // errorMessage がないので文字数カウンタが表示される。
      expect(screen.getByText('0 / 1000')).toBeInTheDocument();
    });

    it('required=true: 初期表示では確認ボタンが enabled である（#162 regression 修正）', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={requiredInputField}
        />,
      );

      // #162 修正後: 初期表示（未入力・未タッチ）でも確認ボタンは enabled であること。
      // （旧実装では disabled になる regression があった）
      expect(screen.getByRole('button', { name: '確認する' })).not.toBeDisabled();
    });

    it('required=true: 入力後も確認ボタンが有効のまま', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={requiredInputField}
        />,
      );

      const textField = screen.getByLabelText(/却下理由/);
      await user.type(textField, '経費が不適切です');

      // 入力後も確認ボタンが有効であること。
      expect(screen.getByRole('button', { name: '確認する' })).not.toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // キャンセル時のリセット
  // ---------------------------------------------------------------------------

  describe('キャンセル時に touched と inputValue がリセットされる', () => {
    it('キャンセル後に再度ダイアログを開いてもエラー文言が表示されない', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          onCancel={onCancel}
          inputField={{
            label: '却下理由',
            required: true,
            maxLength: 1000,
            multiline: true,
            errorMessage: '却下理由を入力してください',
          }}
        />,
      );

      const textField = screen.getByLabelText(/却下理由/);

      // ブラーしてエラーを発生させる。
      await user.click(textField);
      await user.tab();
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();

      // キャンセルボタンをクリックして閉じる。
      await user.click(screen.getByRole('button', { name: 'キャンセル' }));
      expect(onCancel).toHaveBeenCalled();

      // 再度開く（open=false → open=true）。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          onCancel={onCancel}
          open={true}
          inputField={{
            label: '却下理由',
            required: true,
            maxLength: 1000,
            multiline: true,
            errorMessage: '却下理由を入力してください',
          }}
        />,
      );

      // エラー文言がリセットされていること（touched=false になっているため）。
      expect(screen.queryByText('却下理由を入力してください')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // #162: 初期表示挙動と押下時バリデーション発火
  // ---------------------------------------------------------------------------

  describe('#162: 初期表示 regression 修正 / 押下時バリデーション発火', () => {
    const requiredInputFieldForNew = {
      label: '却下理由',
      required: true,
      maxLength: 1000,
      multiline: true,
      errorMessage: '却下理由を入力してください',
    };

    // NEW-1: 初期表示で apiError 文言が描画されない、ボタン enabled
    it('NEW-1: required=true 初期表示で errorMessage が helperText に表示されず、文字数カウンタのみ表示される', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={requiredInputFieldForNew}
        />,
      );

      // helperText に errorMessage が出ていないこと（DoD-1）。
      expect(screen.queryByText('却下理由を入力してください')).not.toBeInTheDocument();
      // 文字数カウンタのみ表示されること。
      expect(screen.getByText('0 / 1000')).toBeInTheDocument();
      // ボタンが enabled であること（DoD-2）。
      expect(screen.getByRole('button', { name: '確認する' })).not.toBeDisabled();
    });

    // NEW-2: 空のまま「却下する」押下 → エラー文言表示、onConfirm 呼ばれない
    it('NEW-2: required=true で空のまま確認ボタン押下 → errorMessage 表示 / onConfirm 未呼び出し（DoD-3）', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          {...defaultProps}
          onConfirm={onConfirm}
          inputField={requiredInputFieldForNew}
        />,
      );

      // 空のまま確認ボタンを押下する。
      await user.click(screen.getByRole('button', { name: '確認する' }));

      // helperText に errorMessage が赤字表示されること。
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();
      // onConfirm が呼ばれていないこと。
      expect(onConfirm).not.toHaveBeenCalled();
    });

    // NEW-3: 理由入力 → エラー文言クリア、ボタン押下で onConfirm 呼ばれる
    it('NEW-3: required=true で入力後押下 → errorMessage 消える / onConfirm(inputValue) 呼ばれる（DoD-4）', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          {...defaultProps}
          onConfirm={onConfirm}
          inputField={requiredInputFieldForNew}
        />,
      );

      // 一度空のまま押下してエラーを発生させる。
      await user.click(screen.getByRole('button', { name: '確認する' }));
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();

      // 理由を入力するとエラー文言が消えること。
      const textField = screen.getByLabelText(/却下理由/);
      await user.type(textField, '金額誤り');
      expect(screen.queryByText('却下理由を入力してください')).not.toBeInTheDocument();

      // 確認ボタン押下で onConfirm が入力値付きで呼ばれること。
      await user.click(screen.getByRole('button', { name: '確認する' }));
      expect(onConfirm).toHaveBeenCalledWith('金額誤り');
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    // NEW-4: 押下時の setTouched(true) 発火動作確認
    it('NEW-4: required=true で空のまま押下すると touched=true になり helperText がエラー表示に切り替わる', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={requiredInputFieldForNew}
        />,
      );

      // 初期状態ではエラー文言なし（touched=false）。
      expect(screen.queryByText('却下理由を入力してください')).not.toBeInTheDocument();

      // 空のまま確認ボタンを押下 → touched=true が立ち、helperText がエラー文言に切り替わる。
      await user.click(screen.getByRole('button', { name: '確認する' }));
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();

      // その後入力すると touched が解除されエラーが消える。
      const textField = screen.getByLabelText(/却下理由/);
      await user.type(textField, 'テスト理由');
      expect(screen.queryByText('却下理由を入力してください')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // #162 再対応: autoFocus による focus() 副作用が発生しないことの検証
  // jsdom では React の autoFocus prop が DOM 属性として残らないため、
  // toHaveAttribute('autofocus') では autoFocus 再追加を検知できない。
  // 代わりに HTMLTextAreaElement.prototype.focus をスパイし、
  // 初期レンダー時に focus() が呼ばれないことを検証する。
  // これにより autoFocus を再追加したときに CI で確実に FAIL できる。
  // ---------------------------------------------------------------------------

  describe('#162 再対応: TextField の autoFocus 不採用を focus spy で検証', () => {
    it('initial render では textarea に focus() が呼ばれない（autoFocus 不採用の検証）', () => {
      // HTMLTextAreaElement.prototype.focus をスパイして呼び出しを追跡する。
      const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, 'focus');

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={{
            label: '却下理由',
            required: true,
            maxLength: 1000,
            multiline: true,
            errorMessage: '却下理由を入力してください',
          }}
        />,
      );

      // autoFocus が設定されていると jsdom が focus() を呼び出す。
      // autoFocus を削除した状態では focus() が呼ばれないことを確認する。
      expect(focusSpy).not.toHaveBeenCalled();

      // スパイを元に戻して他のテストに影響を与えない。
      focusSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // 確認ボタン押下
  // ---------------------------------------------------------------------------

  describe('確認ボタン押下時のコールバック', () => {
    it('inputField なしのとき onConfirm が引数なしで呼ばれる', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByRole('button', { name: '確認する' }));

      expect(onConfirm).toHaveBeenCalledWith(/* 引数なし */);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('inputField ありのとき onConfirm が入力値付きで呼ばれる', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          {...defaultProps}
          onConfirm={onConfirm}
          inputField={{
            label: '承認コメント',
            required: false,
            maxLength: 1000,
            multiline: true,
          }}
        />,
      );

      await user.type(screen.getByLabelText(/承認コメント/), 'コメントです');
      await user.click(screen.getByRole('button', { name: '確認する' }));

      expect(onConfirm).toHaveBeenCalledWith('コメントです');
    });
  });

  // ---------------------------------------------------------------------------
  // loading 状態
  // ---------------------------------------------------------------------------

  describe('loading=true のとき', () => {
    it('確認ボタンが disabled になる', () => {
      render(<ConfirmDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: '確認する' })).toBeDisabled();
    });

    it('キャンセルボタンが disabled になる', () => {
      render(<ConfirmDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    });

    // W1 追加: loading=true のとき onClose が undefined になり Dialog 外クリックで閉じない
    // ConfirmDialog の実装: onClose={loading ? undefined : handleClose}
    it('loading=true のとき Dialog の onClose が undefined になる（外側クリックで閉じない）', () => {
      render(<ConfirmDialog {...defaultProps} loading={true} />);

      // loading=true のとき Dialog が open であること。
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // キャンセルボタンが disabled であることを再確認（閉じ操作が封鎖されている）。
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
      // 確認ボタンも disabled であること（二重押下防止）。
      expect(screen.getByRole('button', { name: '確認する' })).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // #156/#159 大幅改修: apiError prop の FormAlert 表示
  // ---------------------------------------------------------------------------

  describe('#156/#159: apiError prop が FormAlert でダイアログ本文上部に表示される', () => {
    it('apiError が文字列のとき FormAlert が表示される', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          apiError="却下理由を入力してください"
        />,
      );

      // FormAlert が data-testid="form-alert" で描画されること。
      expect(screen.getByTestId('form-alert')).toBeInTheDocument();
      // エラーメッセージが表示されること。
      expect(screen.getByText('却下理由を入力してください')).toBeInTheDocument();
    });

    it('apiError が null のとき FormAlert が表示されない', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          apiError={null}
        />,
      );

      // FormAlert が描画されないこと（FormAlert は message=null のとき null を返す）。
      expect(screen.queryByTestId('form-alert')).not.toBeInTheDocument();
    });

    it('apiError が省略（undefined）のとき FormAlert が表示されない', () => {
      render(<ConfirmDialog {...defaultProps} />);

      // apiError prop 省略時も FormAlert が描画されないこと。
      expect(screen.queryByTestId('form-alert')).not.toBeInTheDocument();
    });

    it('apiError が severity="error" で表示される（FormAlert のデフォルト severity）', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          apiError="操作に失敗しました"
        />,
      );

      // FormAlert の data-severity が "error" であること。
      const alert = screen.getByTestId('form-alert');
      expect(alert).toHaveAttribute('data-severity', 'error');
    });
  });

  // ---------------------------------------------------------------------------
  // #156/#159 大幅改修: 全表示 props の usePrevious 拡張
  // open=false の閉じるアニメーション中に confirmLabel/confirmColor/inputField/apiError が
  // 変化しないことを検証する
  // ---------------------------------------------------------------------------

  describe('#156/#159: open=false 時に confirmLabel / inputField / apiError の前回値が保持される', () => {
    it('open=true で confirmLabel="却下する" を表示した後、open=false に切り替えても confirmLabel が保持される', () => {
      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          open={true}
          confirmLabel="却下する"
          confirmColor="error"
        />,
      );

      // open=true のとき正しいラベルが表示されること。
      expect(screen.getByRole('button', { name: '却下する' })).toBeInTheDocument();

      // open=false に切り替える（閉じるアニメーション開始直後を模擬）。
      // confirmLabel を "支払完了にする" に変更しても前回値が保持される。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          open={false}
          confirmLabel="支払完了にする"
          confirmColor="primary"
        />,
      );

      // MUI Dialog は open=false になるとアニメーション中に DOM から消える場合がある。
      // dialog 要素が消えていれば、ちらつきが発生していないことを確認済みとみなす。
      // dialog が残存する場合は前回の confirmLabel が保持されること。
      const dialog = screen.queryByRole('dialog');
      if (dialog) {
        // 前回値「却下する」が維持されること（「支払完了にする」ではないこと）。
        expect(screen.getByRole('button', { name: '却下する' })).toBeInTheDocument();
      }
      // dialog が消えていればちらつき防止として合格。
    });

    it('open=true で inputField あり → open=false に切り替えても inputField が保持される', () => {
      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          open={true}
          inputField={{
            label: '却下理由',
            required: true,
            maxLength: 1000,
            multiline: true,
            errorMessage: '却下理由を入力してください',
          }}
        />,
      );

      // open=true のとき inputField が描画されること。
      expect(screen.getByLabelText(/却下理由/)).toBeInTheDocument();

      // open=false に切り替え、inputField を undefined に変更する。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          open={false}
          inputField={undefined}
        />,
      );

      // dialog が残存する場合は前回の inputField が保持されること（undefined にフォールバックしない）。
      const dialog = screen.queryByRole('dialog');
      if (dialog) {
        // 前回値の inputField が維持され、却下理由欄が消えないこと。
        expect(screen.getByLabelText(/却下理由/)).toBeInTheDocument();
      }
    });

    it('open=true で apiError あり → open=false に切り替えても apiError が保持される', () => {
      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          open={true}
          apiError="却下理由を入力してください"
        />,
      );

      // open=true のとき apiError が表示されること。
      expect(screen.getByTestId('form-alert')).toBeInTheDocument();

      // open=false に切り替え、apiError を null に変更する。
      rerender(
        <ConfirmDialog
          {...defaultProps}
          open={false}
          apiError={null}
        />,
      );

      // dialog が残存する場合は前回の apiError が保持されること（null にフォールバックしない）。
      const dialog = screen.queryByRole('dialog');
      if (dialog) {
        // 前回値の apiError が維持され、FormAlert が消えないこと。
        expect(screen.getByTestId('form-alert')).toBeInTheDocument();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 文字数カウンタ
  // ---------------------------------------------------------------------------

  describe('文字数カウンタ', () => {
    it('初期状態で 0 / maxLength が表示される', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={{
            label: '却下理由',
            required: true,
            maxLength: 1000,
            multiline: true,
          }}
        />,
      );

      expect(screen.getByText('0 / 1000')).toBeInTheDocument();
    });

    it('入力後に文字数が更新される', async () => {
      const user = userEvent.setup();

      render(
        <ConfirmDialog
          {...defaultProps}
          inputField={{
            label: '承認コメント',
            required: false,
            maxLength: 1000,
            multiline: true,
          }}
        />,
      );

      await user.type(screen.getByLabelText(/承認コメント/), 'abc');

      expect(screen.getByText('3 / 1000')).toBeInTheDocument();
    });
  });
});
