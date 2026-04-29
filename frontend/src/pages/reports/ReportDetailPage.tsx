// レポート詳細ページ。
// RPT-FE-064〜069 の仕様に対応する。
// レポートデータを取得し、ReportInfoCard・ReportActionBar・ItemListSection・ItemSlidePanel を統合する。

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PageSkeleton from '../../components/ui/PageSkeleton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import AppToast from '../../components/ui/AppToast';
import { useReport, useSubmitReport, useDeleteReport } from '../../hooks/useReports';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useApproveReport } from '../../hooks/useApproveReport';
import { useRejectReport } from '../../hooks/useRejectReport';
import { useMarkAsPaid } from '../../hooks/useMarkAsPaid';
import { useCreateItem, useUpdateItem, useDeleteItem } from '../../hooks/useItems';
import { useCategories } from '../../hooks/useCategories';
import ReportInfoCard from './ReportInfoCard';
import ReportActionBar from './ReportActionBar';
import ItemListSection from './ItemListSection';
import ItemSlidePanel from './ItemSlidePanel';
import type { PanelMode } from './ItemSlidePanel';
import type { ItemFormValues } from './ItemForm';
import type { ExpenseItemWithAttachments } from '../../api/types';
import { ApiClientError } from '../../api/client';
import { SERVER_ERROR_MESSAGES } from '../../lib/error-messages';

/** ダイアログの操作種別 */
type DialogAction = 'submit' | 'delete' | null;

/** ワークフロー操作のペンディング種別 */
type WorkflowPendingAction = 'approve' | 'reject' | 'pay' | null;

/** ワークフロー確認ダイアログの操作種別 */
type WorkflowDialogAction = 'approve' | 'reject' | 'pay' | null;

/**
 * スライドパネルの統合状態。
 * 'closed' のときパネルは閉じている。
 * それ以外のとき対応するモードでパネルが開いている。
 * panelOpen / panelMode を分離せず単一 state に集約することで、
 * open 遷移が必ず closed → open になりアニメーションが一貫して発火する。
 */
type PanelState = 'closed' | PanelMode;

/** トースト表示状態 */
interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

/**
 * ReportDetailPage はレポート詳細情報と操作ボタンを表示する画面。
 * 提出・削除操作は確認ダイアログを通じて実行する。
 * ReportInfoCard（情報表示）・ReportActionBar（操作ボタン）および
 * ItemListSection・ItemSlidePanel を統合する。
 */
export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // 現在のユーザー情報を取得する。
  const { data: currentUserResponse } = useCurrentUser();
  const user = currentUserResponse?.data ?? null;

  // ダイアログ表示状態。
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);

  // トースト表示状態。
  const [toast, setToast] = useState<ToastState>({ open: false, message: '', severity: 'error' });

  // 遷移元（ReportCreatePage / ReportEditPage）から location.state 経由で受け取ったトーストを表示する。
  // ReportListPage の location.state.toast パターンを踏襲する。
  useEffect(() => {
    const stateToast = (
      location.state as { toast?: { severity: 'success' | 'error' | 'warning' | 'info'; message: string } } | null
    )?.toast;
    if (stateToast) {
      setToast({ open: true, severity: stateToast.severity, message: stateToast.message });
      // history state をクリアして再レンダリング時に再表示しない。
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // ワークフロー操作のペンディング状態。
  const [workflowPendingAction, setWorkflowPendingAction] = useState<WorkflowPendingAction>(null);

  // ワークフロー確認ダイアログの操作種別。
  const [workflowDialogAction, setWorkflowDialogAction] = useState<WorkflowDialogAction>(null);

  // 却下ダイアログ専用の API エラー state（#159 F1 対応, D4 規定）。
  // 422 MissingRejectionReason 等の API エラーをダイアログ内で表示するために使用する。
  // 却下以外（承認・支払）は旧トーストパターンを使うため、却下専用 state として維持する。
  const [rejectDialogApiError, setRejectDialogApiError] = useState<string | null>(null);

  // 409 Conflict が発生したかどうか（競合バナー表示に使用）。
  const [conflictDetected, setConflictDetected] = useState(false);

  // 明細削除確認ダイアログ用: 削除対象の明細 ID。
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // スライドパネルの統合状態（'closed' | 'add' | 'edit' | 'view'）。
  // 単一 state に集約することで open 遷移が必ず closed → open になり、
  // Drawer のスライドアニメーションが全経路で一貫して発火する。
  const [panelState, setPanelState] = useState<PanelState>('closed');

  // 直前の非 closed モードを保持する ref（issue #130）。
  // panelState が 'closed' に遷移したとき、Drawer のスライドアウトアニメーション中に
  // mode prop が 'add' にフォールバックされてフラッシュが発生する問題を防ぐため、
  // 閉じる直前のモードをここに記録し、closed 中は lastModeRef.current を mode prop に渡す。
  const lastModeRef = useRef<PanelMode>('add');

  const [selectedItem, setSelectedItem] = useState<ExpenseItemWithAttachments | null>(null);
  const [itemApiError, setItemApiError] = useState<string | null>(null);

  // 「保存して続けて追加」後にフォームを再マウントするためのキー。
  const [formKey, setFormKey] = useState(0);

  // レポートデータを取得する。
  const { data, isLoading, isError, error } = useReport(id);
  const report = data?.data;

  // カテゴリ一覧を取得する。
  const { data: categoriesData } = useCategories();
  const categoryOptions =
    categoriesData?.map((c) => ({ value: c.id, label: c.name_ja })) ?? [];

  // レポート操作ミューテーション。
  const { mutate: submitMutate, isPending: isSubmitPending } = useSubmitReport();
  const { mutate: deleteMutate, isPending: isDeletePending } = useDeleteReport();

  // ワークフロー操作ミューテーション。
  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();
  const markAsPaid = useMarkAsPaid();

  // 明細操作ミューテーション。
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  // ローディング中はスケルトン表示。
  if (isLoading) {
    return <PageSkeleton variant="card" />;
  }

  // エラー時はステータスコードに応じた表示を行う。
  if (isError) {
    // 404: EmptyState 表示（report-detail.md §11）。
    // 画面構造の分岐のみ status で判断する。
    if (error instanceof ApiClientError && error.status === 404) {
      return (
        <Box>
          <Typography>{SERVER_ERROR_MESSAGES.RESOURCE_NOT_FOUND}</Typography>
          <Link to="/reports">レポート一覧</Link>
        </Box>
      );
    }

    // 表示文言は client.ts 層でマッピング済みの err.message をそのまま使う。
    // 非 ApiClientError（ネットワーク障害等）のフォールバックのみ SERVER_ERROR_MESSAGES を参照する。
    const toastMessage =
      error instanceof Error
        ? error.message
        : SERVER_ERROR_MESSAGES.INTERNAL_ERROR;

    return (
      <Box>
        <AppToast
          open
          severity="error"
          message={toastMessage}
          onClose={() => undefined}
        />
        <Typography sx={{ mt: 2 }}>{toastMessage}</Typography>
        <Link to="/reports">レポート一覧</Link>
      </Box>
    );
  }

  if (!report) {
    return null;
  }

  /**
   * アクションエラー時の共通トースト表示処理。
   * ApiClientError の場合は client.ts 層でマッピング済みの err.message をそのまま使う。
   * 409 Conflict のみ競合バナー表示の副作用があるため個別処理する。
   */
  const handleActionError = (err: unknown, fallbackMsg: string) => {
    if (err instanceof ApiClientError) {
      if (err.status === 409) {
        // 競合検知: バナーを表示して再読み込みを促す。
        setConflictDetected(true);
        setToast({
          open: true,
          severity: 'warning',
          message: err.message || SERVER_ERROR_MESSAGES.CONFLICT,
        });
        return;
      }
      // client.ts 層で SERVER_ERROR_MESSAGES にマッピング済みの err.message をそのまま使う。
      setToast({
        open: true,
        severity: 'error',
        message: err.message || fallbackMsg,
      });
    } else {
      // ApiClientError 以外（ネットワーク障害等）: err.message を使い、なければフォールバックを使う。
      const message = err instanceof Error ? err.message : (fallbackMsg || SERVER_ERROR_MESSAGES.INTERNAL_ERROR);
      setToast({
        open: true,
        severity: 'error',
        message,
      });
    }
  };

  /**
   * 提出確認後の処理。キャッシュを更新してダイアログを閉じる。
   */
  const handleSubmitConfirm = () => {
    submitMutate(
      { id: report.id, updated_at: report.updated_at },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['reports', 'detail', report.id] });
          setDialogAction(null);
          setToast({ open: true, severity: 'success', message: 'レポートを提出しました' });
        },
        onError: (err: Error) => {
          setDialogAction(null);
          handleActionError(err, '提出に失敗しました');
        },
      },
    );
  };

  /**
   * 削除確認後の処理。成功後は /reports に遷移する。
   */
  const handleDeleteConfirm = () => {
    deleteMutate(report.id, {
      onSuccess: () => {
        // 削除成功後: 遷移先の ReportListPage でトーストを表示するために state を渡す。
        navigate('/reports', { state: { toast: { severity: 'success', message: 'レポートを削除しました' } } });
      },
      onError: (err: Error) => {
        setDialogAction(null);
        handleActionError(err, '削除に失敗しました');
      },
    });
  };

  /**
   * ダイアログの「はい」ボタン押下時の処理。
   */
  const handleDialogConfirm = () => {
    if (dialogAction === 'submit') {
      handleSubmitConfirm();
    } else if (dialogAction === 'delete') {
      handleDeleteConfirm();
    }
  };

  // 現在のユーザーがオーナーかどうか（draft 状態で操作可能）。
  const isOwner = user?.id === report.submitter?.id;

  /**
   * 承認ボタン押下時の処理。確認ダイアログを開く。
   */
  const handleApprove = () => {
    setWorkflowDialogAction('approve');
  };

  /**
   * 却下ボタン押下時の処理。確認ダイアログを開き、前回の apiError をクリアする。
   */
  const handleReject = () => {
    setRejectDialogApiError(null);
    setWorkflowDialogAction('reject');
  };

  /**
   * 支払完了ボタン押下時の処理。確認ダイアログを開く。
   */
  const handleMarkAsPaid = () => {
    setWorkflowDialogAction('pay');
  };

  /**
   * ワークフロー確認ダイアログの「確認」ボタン押下時の処理。
   * approve: 承認コメント（任意）付きで承認 API を呼ぶ。
   * reject: 却下理由（必須）付きで却下 API を呼ぶ。
   * pay: 支払完了 API を呼ぶ。
   *
   * 処理フロー:
   * - approve/pay: ダイアログを即時閉じてから API を呼ぶ（旧トーストパターン）。
   *   エラー時はトーストで通知する。
   * - reject: 設計書 report-detail.md §D4 規定に基づき、ダイアログを閉じずに API を呼ぶ。
   *   422 MissingRejectionReason 等の API エラーはダイアログ内の FormAlert で表示する（F1 修正）。
   */
  const handleWorkflowDialogConfirm = (inputValue?: string) => {
    if (workflowDialogAction === 'approve') {
      // 承認: ダイアログを即時閉じてから API を呼ぶ（旧トーストパターン）。
      setWorkflowDialogAction(null);
      setWorkflowPendingAction('approve');
      approveReport.mutate(
        { id: report.id, comment: inputValue, updated_at: report.updated_at },
        {
          onSuccess: () => {
            setWorkflowPendingAction(null);
            setToast({ open: true, severity: 'success', message: 'レポートを承認しました' });
          },
          onError: (err: Error) => {
            setWorkflowPendingAction(null);
            // エラー時はトーストで通知する（承認は旧トーストパターン）。
            const message = err instanceof Error ? err.message : '承認に失敗しました';
            setToast({ open: true, severity: 'error', message });
          },
        },
      );
    } else if (workflowDialogAction === 'reject') {
      // 却下: ダイアログは閉じずに API を呼ぶ（D4 規定に基づく apiError パターン）。
      // 422 MissingRejectionReason は rejectDialogApiError としてダイアログ内に表示する（F1 修正）。
      setWorkflowPendingAction('reject');
      rejectReport.mutate(
        { id: report.id, reason: inputValue ?? '', updated_at: report.updated_at },
        {
          onSuccess: () => {
            setWorkflowPendingAction(null);
            setWorkflowDialogAction(null);
            setRejectDialogApiError(null);
            setToast({ open: true, severity: 'success', message: 'レポートを却下しました' });
          },
          onError: (err: Error) => {
            setWorkflowPendingAction(null);
            // エラー時はダイアログを閉じずに rejectDialogApiError を set する（F1 修正）。
            // client.ts 層でマッピング済みの err.message をそのまま使う。
            const message = err instanceof Error ? err.message : '却下に失敗しました';
            setRejectDialogApiError(message);
          },
        },
      );
    } else if (workflowDialogAction === 'pay') {
      // 支払完了: ダイアログを即時閉じてから API を呼ぶ（旧トーストパターン）。
      setWorkflowDialogAction(null);
      setWorkflowPendingAction('pay');
      markAsPaid.mutate(
        { id: report.id, updated_at: report.updated_at },
        {
          onSuccess: () => {
            setWorkflowPendingAction(null);
            setToast({ open: true, severity: 'success', message: '支払完了を記録しました' });
          },
          onError: (err: Error) => {
            setWorkflowPendingAction(null);
            // エラー時はトーストで通知する（支払完了は旧トーストパターン）。
            const message = err instanceof Error ? err.message : '支払完了の記録に失敗しました';
            setToast({ open: true, severity: 'error', message });
          },
        },
      );
    }
  };

  /**
   * ワークフロー確認ダイアログのキャンセル処理。
   * 却下ダイアログ用の rejectDialogApiError をクリアしてダイアログを閉じる。
   */
  const handleWorkflowDialogCancel = () => {
    setRejectDialogApiError(null);
    setWorkflowDialogAction(null);
  };

  /**
   * 明細追加ボタン押下時の処理。
   * panelState が 'closed' → 'add' に遷移するため、アニメーションが発火する。
   */
  const handleAddItem = () => {
    setSelectedItem(null);
    setItemApiError(null);
    lastModeRef.current = 'add';
    setPanelState('add');
  };

  /**
   * 明細行クリック時の処理（閲覧モードでスライドパネルを開く）。
   * 既にパネルが開いている場合は一度 'closed' に戻してから 'view' に遷移し、
   * 必ず false → true の Drawer open 遷移を発火させてアニメーションを統一する。
   */
  const handleItemClick = (itemId: string) => {
    const item = report.items.find((it) => it.id === itemId) ?? null;
    setSelectedItem(item);
    setItemApiError(null);
    // formKey をインクリメントして ItemSlidePanel を再マウントし、フォームに既存値をプリフィルする。
    setFormKey((prev) => prev + 1);
    // flushSync で 'closed' を同期的にコミットしてから 'view' に遷移することで、
    // Drawer の open prop が必ず false → true の遷移を経由し、アニメーションが確実に発火する。
    // setTimeout(0) ハックを廃止し、race の余地を設計的に解消する。
    flushSync(() => {
      setPanelState('closed');
    });
    lastModeRef.current = 'view';
    setPanelState('view');
  };

  /**
   * 明細編集ボタン押下時の処理。
   * 既にパネルが開いている場合は一度 'closed' に戻してから 'edit' に遷移し、
   * 必ず false → true の Drawer open 遷移を発火させてアニメーションを統一する。
   */
  const handleEditItem = (itemId: string) => {
    const item = report.items.find((it) => it.id === itemId) ?? null;
    setSelectedItem(item);
    setItemApiError(null);
    // formKey をインクリメントして ItemSlidePanel を再マウントし、フォームに既存値をプリフィルする。
    setFormKey((prev) => prev + 1);
    // flushSync で 'closed' を同期的にコミットしてから 'edit' に遷移することで、
    // Drawer の open prop が必ず false → true の遷移を経由し、アニメーションが確実に発火する。
    // setTimeout(0) ハックを廃止し、race の余地を設計的に解消する。
    flushSync(() => {
      setPanelState('closed');
    });
    lastModeRef.current = 'edit';
    setPanelState('edit');
  };

  /**
   * 明細削除ボタン押下時の処理。確認ダイアログを開く。
   */
  const handleDeleteItem = (itemId: string) => {
    setDeletingItemId(itemId);
  };

  /**
   * 明細削除確認ダイアログの「削除する」ボタン押下時の処理。
   * ダイアログを即時閉じてから API を呼ぶ（旧トーストパターン）。
   * エラー時はトーストで通知する。
   */
  const handleDeleteItemConfirm = () => {
    if (deletingItemId === null) return;
    setDeletingItemId(null);
    deleteItem.mutate(
      { reportId: report.id, itemId: deletingItemId },
      {
        onSuccess: () => {
          setToast({ open: true, severity: 'success', message: '明細を削除しました' });
        },
        onError: (err) => {
          // エラー時はトーストで通知する（明細削除は旧トーストパターン）。
          // client.ts 層でマッピング済みの err.message をそのまま使う。
          const message = err instanceof Error ? err.message : '明細の削除に失敗しました';
          setToast({ open: true, severity: 'error', message });
        },
      },
    );
  };

  /**
   * 明細削除確認ダイアログのキャンセル処理。
   */
  const handleDeleteItemCancel = () => {
    setDeletingItemId(null);
  };

  /**
   * スライドパネルのフォーム送信処理（追加・編集）。
   */
  const handleItemSubmit = (data: ItemFormValues) => {
    setItemApiError(null);
    if (panelState === 'add') {
      createItem.mutate(
        {
          reportId: report.id,
          expense_date: data.expenseDate,
          amount: data.amount,
          category_id: data.categoryId,
          description: data.description,
        },
        {
          onSuccess: () => {
            setPanelState('closed');
            setToast({ open: true, severity: 'success', message: '明細を追加しました' });
          },
          onError: (err) => {
            // client.ts 層でマッピング済みの err.message をそのまま使う。
            const message = err instanceof Error ? err.message : '明細の追加に失敗しました';
            setItemApiError(message);
          },
        },
      );
    } else if (panelState === 'edit' && selectedItem) {
      updateItem.mutate(
        {
          reportId: report.id,
          itemId: selectedItem.id,
          expense_date: data.expenseDate,
          amount: data.amount,
          category_id: data.categoryId,
          description: data.description,
          updated_at: selectedItem.updated_at,
        },
        {
          onSuccess: () => {
            setPanelState('closed');
            setToast({ open: true, severity: 'success', message: '明細を更新しました' });
          },
          onError: (err) => {
            // client.ts 層でマッピング済みの err.message をそのまま使う。
            const message = err instanceof Error ? err.message : '明細の更新に失敗しました';
            setItemApiError(message);
          },
        },
      );
    }
  };

  /**
   * 「保存して続けて追加」処理。
   * 成功後は formKey をインクリメントして ItemSlidePanel を再マウントし、フォームをリセットする。
   */
  const handleItemSaveAndContinue = (data: ItemFormValues) => {
    setItemApiError(null);
    createItem.mutate(
      {
        reportId: report.id,
        expense_date: data.expenseDate,
        amount: data.amount,
        category_id: data.categoryId,
        description: data.description,
      },
      {
        onSuccess: () => {
          // formKey をインクリメントして ItemSlidePanel を再マウントし、フォームをリセットする。
          setSelectedItem(null);
          setFormKey((prev) => prev + 1);
          lastModeRef.current = 'add';
          setPanelState('add');
          setToast({ open: true, severity: 'success', message: '明細を追加しました' });
        },
        onError: (err) => {
          // client.ts 層でマッピング済みの err.message をそのまま使う。
          const message = err instanceof Error ? err.message : '明細の追加に失敗しました';
          setItemApiError(message);
        },
      },
    );
  };

  const isItemPending = createItem.isPending || updateItem.isPending;

  // ReportActionBar に渡す pendingAction。ワークフロー操作のペンディング状態を文字列として渡す。
  const actionBarPendingAction = workflowPendingAction ?? null;

  return (
    <Box>
      {/* 競合検知バナー: 409 Conflict が発生した場合に再読み込みを促す */}
      {conflictDetected && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography>このレポートは他のユーザーによって更新されました。</Typography>
          <Button variant="contained" size="small" onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </Box>
      )}

      {/* レポート情報カード（基本情報・ワークフロー情報・再申請元リンクを含む） */}
      <Box sx={{ mb: 3 }}>
        <ReportInfoCard report={report} />
      </Box>

      {/* アクションバー（ロール・所有権・ステータスに応じたボタンを表示） */}
      <Box sx={{ mb: 2 }}>
        <ReportActionBar
          status={report.status}
          isOwner={isOwner}
          currentUserRole={user?.role ?? ''}
          itemCount={report.items.length}
          pendingAction={actionBarPendingAction}
          onEdit={() => navigate(`/reports/${report.id}/edit`)}
          onSubmitReport={() => setDialogAction('submit')}
          onDelete={() => setDialogAction('delete')}
          onResubmit={() => navigate(`/reports/new?ref=${report.id}`)}
          onApprove={handleApprove}
          onReject={handleReject}
          onPay={handleMarkAsPaid}
        />
      </Box>

      {/* 明細一覧セクション */}
      <Box sx={{ mb: 3 }}>
        <ItemListSection
          items={report.items}
          isOwner={isOwner}
          status={report.status}
          onAddItem={handleAddItem}
          onItemClick={handleItemClick}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      </Box>

      {/* 明細スライドパネル（formKey で再マウントしてフォームリセットを実現）。
          open は panelState !== 'closed' で判定し、常に false → true の遷移を経てアニメーションが発火する。
          mode: panelState が 'closed' のとき lastModeRef.current を渡すことで、スライドアウト中に
            mode が 'add' にフォールバックされてレイアウトがフラッシュする issue #130 を解消する。
          onTransitionExited: スライドアウト完了後に selectedItem / itemApiError をリセットする。
            アニメーション中はリセットしないことで view/edit モードの DOM を維持し、フラッシュを防ぐ。 */}
      <ItemSlidePanel
        key={formKey}
        open={panelState !== 'closed'}
        mode={panelState === 'closed' ? lastModeRef.current : panelState}
        reportId={report.id}
        item={selectedItem}
        reportStatus={report.status}
        isOwner={isOwner}
        onClose={() => setPanelState('closed')}
        onSaveSuccess={() => setPanelState('closed')}
        onSaveAndContinue={() => {
          setSelectedItem(null);
          lastModeRef.current = 'add';
          setPanelState('add');
        }}
        onTransitionExited={() => {
          // スライドアウトアニメーション完了後に selectedItem と itemApiError をリセットする。
          // アニメーション完了前（panelState='closed' 直後）にリセットすると、
          // Drawer がスライドアウト中の DOM に mode='add' の UI が描画されてフラッシュが発生するため、
          // onExited コールバックで遅延リセットする（MUI 公式パターン: SlideProps.onExited）。
          setSelectedItem(null);
          setItemApiError(null);
        }}
        categories={categoryOptions}
        apiError={itemApiError}
        isPending={isItemPending}
        onItemSubmit={handleItemSubmit}
        onItemSaveAndContinue={handleItemSaveAndContinue}
        reportPeriodStart={report.period_start}
        reportPeriodEnd={report.period_end}
      />

      {/* 提出・削除確認ダイアログ
          W1 修正: loading prop に isSubmitPending / isDeletePending を連動させ、
          API 実行中の二重押下防止とキャンセル不可を実現する（SMK-011 準拠）。 */}
      <ConfirmDialog
        open={dialogAction !== null}
        title={dialogAction === 'submit' ? 'レポートを提出しますか？' : 'レポートを削除しますか？'}
        message={
          dialogAction === 'submit'
            ? 'このレポートを提出します。提出後は編集できません。'
            : 'このレポートを削除します。この操作は取り消せません。'
        }
        confirmLabel="はい"
        confirmColor={dialogAction === 'delete' ? 'error' : 'primary'}
        cancelLabel="キャンセル"
        loading={dialogAction === 'submit' ? isSubmitPending : isDeletePending}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogAction(null)}
      />

      {/* ワークフロー操作確認ダイアログ（承認・却下・支払完了）
          F2 修正: confirmLabel/confirmColor/inputField を usePrevious（ConfirmDialog 内部）で保持し、
                   閉じるアニメーション中のちらつきを防ぐ。
          W1 修正: loading prop に各 mutation の isPending を連動させ、
                   API 実行中の二重押下防止・キャンセル不可を実現する（SMK-011 準拠）。
          F1 対応（却下のみ）: 却下エラー時はダイアログを open 維持 + rejectDialogApiError を表示する。
                   承認・支払はエラー時にトーストで通知し、ダイアログを即時閉じる（旧トーストパターン）。
          title の三項演算子は pay を明示し、null フォールバックによるちらつきを二重防御する (#156) */}
      <ConfirmDialog
        open={workflowDialogAction !== null}
        title={
          workflowDialogAction === 'approve'
            ? 'このレポートを承認しますか？'
            : workflowDialogAction === 'reject'
              ? 'このレポートを却下しますか？'
              : workflowDialogAction === 'pay'
                ? 'このレポートの支払完了を記録しますか？'
                : ''
        }
        message=""
        confirmLabel={
          workflowDialogAction === 'approve'
            ? '承認する'
            : workflowDialogAction === 'reject'
              ? '却下する'
              : '支払完了にする'
        }
        confirmColor={workflowDialogAction === 'reject' ? 'error' : 'primary'}
        cancelLabel="キャンセル"
        loading={
          workflowDialogAction === 'approve'
            ? approveReport.isPending
            : workflowDialogAction === 'reject'
              ? rejectReport.isPending
              : markAsPaid.isPending
        }
        inputField={
          workflowDialogAction === 'approve'
            ? {
                label: '承認コメント',
                required: false,
                maxLength: 1000,
                multiline: true,
              }
            : workflowDialogAction === 'reject'
              ? {
                  label: '却下理由',
                  required: true,
                  maxLength: 1000,
                  multiline: true,
                  // 空ブラー時に helperText に表示するエラー文言 (#159)
                  errorMessage: '却下理由を入力してください',
                }
              : undefined
        }
        apiError={workflowDialogAction === 'reject' ? rejectDialogApiError : null}
        onConfirm={handleWorkflowDialogConfirm}
        onCancel={handleWorkflowDialogCancel}
      />

      {/* 明細削除確認ダイアログ
          W1 修正: loading prop に deleteItem.isPending を連動させ、
                   API 実行中の二重押下防止・キャンセル不可を実現する（SMK-011 準拠）。
          エラー時はトーストで通知し、ダイアログを即時閉じる（旧トーストパターン）。 */}
      <ConfirmDialog
        open={deletingItemId !== null}
        title="この明細を削除しますか？"
        message="この操作は取り消せません。"
        confirmLabel="削除する"
        confirmColor="error"
        cancelLabel="キャンセル"
        loading={deleteItem.isPending}
        onConfirm={handleDeleteItemConfirm}
        onCancel={handleDeleteItemCancel}
      />

      {/* トースト通知（エラーや成功メッセージ） */}
      <AppToast
        open={toast.open}
        severity={toast.severity}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </Box>
  );
}
