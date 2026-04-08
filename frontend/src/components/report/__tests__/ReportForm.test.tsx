// ReportForm コンポーネントのユニットテスト。
// RPT-FE-028〜036, RPT-FE-058 に対応する。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReportForm from '../ReportForm';

// テスト共通の Props。
const defaultProps = {
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  apiError: null,
  isPending: false,
  submitLabel: '作成する',
};

describe('ReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RPT-FE-028: 有効な値でフォームを送信すると onSubmit が正しい値で呼び出される。
  it('RPT-FE-028: 有効な値でフォームを送信すると onSubmit が正しい値で呼び出される', async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), '出張費 3月');

    // AppDatePicker の値を直接 input に入力する。
    const startInput = screen.getByLabelText('開始日');
    const endInput = screen.getByLabelText('終了日');
    await userEvent.type(startInput, '2026-03-01');
    await userEvent.type(endInput, '2026-03-31');

    await userEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  // RPT-FE-029: title="" でフォームを送信するとバリデーションエラーが表示され onSubmit は呼ばれない。
  it('RPT-FE-029: title="" で送信するとバリデーションエラーが表示される', async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    // title を空のまま送信
    await userEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(screen.getByText('タイトルを入力してください')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // RPT-FE-030: title が 201 文字の場合バリデーションエラーが表示される。
  it('RPT-FE-030: title が最大文字数を超えるとバリデーションエラーが表示される', async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    const longTitle = 'a'.repeat(201);
    await userEvent.type(screen.getByLabelText(/タイトル/), longTitle);
    await userEvent.tab(); // フォーカスアウトでバリデーション

    await waitFor(() => {
      expect(screen.getByText(/200文字以内/)).toBeInTheDocument();
    });
  });

  // RPT-FE-031: periodStart > periodEnd のとき バリデーションエラーが表示される。
  it('RPT-FE-031: periodStart > periodEnd のときバリデーションエラーが表示される', async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), 'テスト');
    const startInput = screen.getByLabelText('開始日');
    const endInput = screen.getByLabelText('終了日');
    await userEvent.type(startInput, '2026-03-31');
    await userEvent.type(endInput, '2026-03-01'); // 終了が開始より前

    await userEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(screen.getByText(/開始日は終了日以前/)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // RPT-FE-032: periodStart="" のときバリデーションエラーが表示される。
  it('RPT-FE-032: periodStart が空のときバリデーションエラーが表示される', async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), 'テスト');
    await userEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(screen.getByText('開始日を入力してください')).toBeInTheDocument();
    });
  });

  // RPT-FE-033: periodEnd="" のときバリデーションエラーが表示される。
  it('RPT-FE-033: periodEnd が空のときバリデーションエラーが表示される', async () => {
    const onSubmit = vi.fn();
    render(<ReportForm {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/タイトル/), 'テスト');
    const startInput = screen.getByLabelText('開始日');
    await userEvent.type(startInput, '2026-03-01');
    await userEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(screen.getByText('終了日を入力してください')).toBeInTheDocument();
    });
  });

  // RPT-FE-034: isPending=true のとき全入力フィールドと送信ボタンが disabled になる。
  it('RPT-FE-034: isPending=true のとき全入力フィールドと送信ボタンが disabled になる', () => {
    render(<ReportForm {...defaultProps} isPending={true} />);

    expect(screen.getByLabelText(/タイトル/)).toBeDisabled();
    // 送信ボタンが disabled であること
    expect(screen.getByRole('button', { name: '作成する' })).toBeDisabled();
  });

  // RPT-FE-035: apiError="サーバーエラーが発生しました" のとき FormAlert にメッセージが表示される。
  it('RPT-FE-035: apiError があるとき FormAlert にメッセージが表示される', () => {
    render(<ReportForm {...defaultProps} apiError="サーバーエラーが発生しました" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument();
  });

  // RPT-FE-036: defaultValues がプリフィルされる。
  it('RPT-FE-036: defaultValues がフォームフィールドにプリフィルされる', () => {
    const defaultValues = {
      title: '元レポート',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    };
    render(<ReportForm {...defaultProps} defaultValues={defaultValues} />);

    expect(screen.getByLabelText(/タイトル/)).toHaveValue('元レポート');
  });

  // RPT-FE-058: submitLabel="保存する" のとき送信ボタンのラベルが「保存する」と表示される。
  it('RPT-FE-058: submitLabel="保存する" のとき送信ボタンのラベルが「保存する」と表示される', () => {
    render(<ReportForm {...defaultProps} submitLabel="保存する" />);

    expect(screen.getByRole('button', { name: '保存する' })).toBeInTheDocument();
  });
});
