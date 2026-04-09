// レポート詳細ページ。
// RPT-FE-064〜069 の仕様に対応する。
// レポートデータを取得し、ReportBasicInfo・WorkflowActions・ItemListSection・ItemSlidePanel を統合する。

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PageSkeleton from '../components/ui/PageSkeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useReport, useSubmitReport, useDeleteReport } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { useApproveReport } from '../hooks/useApproveReport';
import { useRejectReport } from '../hooks/useRejectReport';
import { useMarkAsPaid } from '../hooks/useMarkAsPaid';
import { useCreateItem, useUpdateItem, useDeleteItem } from '../hooks/useItems';
import { useCategories } from '../hooks/useCategories';
import ReportBasicInfo from './reports/ReportBasicInfo';
import WorkflowActions from './reports/WorkflowActions';
import ItemListSection from './reports/ItemListSection';
import ItemSlidePanel, { type PanelMode } from './reports/ItemSlidePanel';
import type { ItemFormValues } from './reports/ItemForm';
import type { ExpenseItemWithAttachments } from '../api/types';

/** ダイアログの操作種別 */
type DialogAction = 'submit' | 'delete' | null;

/** ワークフロー操作のペンディング種別 */
type WorkflowPendingAction = 'approve' | 'reject' | 'pay' | null;

/** ワークフロー確認ダイアログの操作種別 */
type WorkflowDialogAction = 'approve' | 'reject' | 'pay' | null;

/**
 * ReportDetailPage はレポート詳細情報と操作ボタンを表示する画面。
 * 提出・削除操作は確認ダイアログを通じて実行する。
 * WorkflowActions（承認・却下・支払完了）および ItemListSection・ItemSlidePanel を統合する。
 */
export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 現在のユーザー情報を取得する。
  const { user } = useAuth();

  // ダイアログ表示状態。
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);

  // ワークフロー操作のペンディング状態。
  const [workflowPendingAction, setWorkflowPendingAction] = useState<WorkflowPendingAction>(null);

  // ワークフロー確認ダイアログの操作種別。
  const [workflowDialogAction, setWorkflowDialogAction] = useState<WorkflowDialogAction>(null);

  // 明細削除確認ダイアログ用: 削除対象の明細 ID。
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // スライドパネルの状態。
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add');
  const [selectedItem, setSelectedItem] = useState<ExpenseItemWithAttachments | null>(null);
  const [itemApiError, setItemApiError] = useState<string | null>(null);

  // レポートデータを取得する。
  const { data, isLoading, isError } = useReport(id);
  const report = data?.data;

  // カテゴリ一覧を取得する。
  const { data: categoriesData } = useCategories();
  const categoryOptions =
    categoriesData?.map((c) => ({ value: c.id, label: c.name_ja })) ?? [];

  // レポート操作ミューテーション。
  const { mutate: submitMutate } = useSubmitReport();
  const { mutate: deleteMutate } = useDeleteReport();

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

  // 404 エラー時は Not Found メッセージを表示する。
  if (isError) {
    return (
      <Box>
        <Typography>指定されたデータが見つかりません。</Typography>
        <Link to="/reports">レポート一覧</Link>
      </Box>
    );
  }

  if (!report) {
    return null;
  }

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
        },
        onError: () => {
          setDialogAction(null);
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
        navigate('/reports');
      },
      onError: () => {
        setDialogAction(null);
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
  const isDraft = report.status === 'draft';

  /**
   * 承認ボタン押下時の処理。確認ダイアログを開く。
   */
  const handleApprove = () => {
    setWorkflowDialogAction('approve');
  };

  /**
   * 却下ボタン押下時の処理。確認ダイアログを開く。
   */
  const handleReject = () => {
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
   */
  const handleWorkflowDialogConfirm = (inputValue?: string) => {
    if (workflowDialogAction === 'approve') {
      setWorkflowDialogAction(null);
      setWorkflowPendingAction('approve');
      approveReport.mutate(
        { id: report.id, comment: inputValue, updated_at: report.updated_at },
        {
          onSuccess: () => setWorkflowPendingAction(null),
          onError: () => setWorkflowPendingAction(null),
        },
      );
    } else if (workflowDialogAction === 'reject') {
      setWorkflowDialogAction(null);
      setWorkflowPendingAction('reject');
      rejectReport.mutate(
        { id: report.id, reason: inputValue ?? '', updated_at: report.updated_at },
        {
          onSuccess: () => setWorkflowPendingAction(null),
          onError: () => setWorkflowPendingAction(null),
        },
      );
    } else if (workflowDialogAction === 'pay') {
      setWorkflowDialogAction(null);
      setWorkflowPendingAction('pay');
      markAsPaid.mutate(
        { id: report.id, updated_at: report.updated_at },
        {
          onSuccess: () => setWorkflowPendingAction(null),
          onError: () => setWorkflowPendingAction(null),
        },
      );
    }
  };

  /**
   * 明細追加ボタン押下時の処理。
   */
  const handleAddItem = () => {
    setSelectedItem(null);
    setPanelMode('add');
    setItemApiError(null);
    setPanelOpen(true);
  };

  /**
   * 明細行クリック時の処理（閲覧モードでスライドパネルを開く）。
   */
  const handleItemClick = (itemId: string) => {
    const item = report.items.find((it) => it.id === itemId) ?? null;
    setSelectedItem(item);
    setPanelMode('view');
    setItemApiError(null);
    setPanelOpen(true);
  };

  /**
   * 明細編集ボタン押下時の処理。
   */
  const handleEditItem = (itemId: string) => {
    const item = report.items.find((it) => it.id === itemId) ?? null;
    setSelectedItem(item);
    setPanelMode('edit');
    setItemApiError(null);
    setPanelOpen(true);
  };

  /**
   * 明細削除ボタン押下時の処理。確認ダイアログを開く。
   */
  const handleDeleteItem = (itemId: string) => {
    setDeletingItemId(itemId);
  };

  /**
   * 明細削除確認ダイアログの「削除する」ボタン押下時の処理。
   */
  const handleDeleteItemConfirm = () => {
    if (deletingItemId === null) return;
    deleteItem.mutate({ reportId: report.id, itemId: deletingItemId });
    setDeletingItemId(null);
  };

  /**
   * スライドパネルのフォーム送信処理（追加・編集）。
   */
  const handleItemSubmit = (data: ItemFormValues) => {
    setItemApiError(null);
    if (panelMode === 'add') {
      createItem.mutate(
        {
          reportId: report.id,
          expense_date: data.expenseDate,
          amount: data.amount,
          category_id: data.categoryId,
          description: data.description,
        },
        {
          onSuccess: () => setPanelOpen(false),
          onError: () => setItemApiError('明細の追加に失敗しました'),
        },
      );
    } else if (panelMode === 'edit' && selectedItem) {
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
          onSuccess: () => setPanelOpen(false),
          onError: () => setItemApiError('明細の更新に失敗しました'),
        },
      );
    }
  };

  /**
   * 「保存して続けて追加」処理。
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
          // フォームをリセットして追加モードを継続する。
          setSelectedItem(null);
          setPanelMode('add');
        },
        onError: () => setItemApiError('明細の追加に失敗しました'),
      },
    );
  };

  const isItemPending = createItem.isPending || updateItem.isPending;

  return (
    <Box>
      {/* レポート基本情報 */}
      <Box sx={{ mb: 3 }}>
        <ReportBasicInfo
          title={report.title}
          status={report.status}
          periodStart={report.period_start}
          periodEnd={report.period_end}
          totalAmount={report.total_amount}
          submitterName={report.submitter?.name ?? ''}
          createdAt={report.created_at}
        />
      </Box>

      {/* オーナー向け操作ボタン（提出・削除） */}
      {isOwner && isDraft && (
        <Box data-testid="report-action-bar" sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <button
            type="button"
            onClick={() => setDialogAction('submit')}
          >
            提出する
          </button>
          <button
            type="button"
            onClick={() => setDialogAction('delete')}
          >
            削除する
          </button>
        </Box>
      )}

      {/* ワークフロー操作ボタン（承認・却下・支払完了） */}
      {user?.role && (
        <Box sx={{ mb: 2 }}>
          <WorkflowActions
            status={report.status}
            currentUserRole={user.role}
            isOwner={isOwner}
            onApprove={handleApprove}
            onReject={handleReject}
            onMarkAsPaid={handleMarkAsPaid}
            pendingAction={workflowPendingAction}
          />
        </Box>
      )}

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

      {/* 明細スライドパネル */}
      <ItemSlidePanel
        open={panelOpen}
        mode={panelMode}
        reportId={report.id}
        item={selectedItem}
        reportStatus={report.status}
        isOwner={isOwner}
        onClose={() => setPanelOpen(false)}
        onSaveSuccess={() => setPanelOpen(false)}
        onSaveAndContinue={() => {
          setSelectedItem(null);
          setPanelMode('add');
        }}
        categories={categoryOptions}
        apiError={itemApiError}
        isPending={isItemPending}
        onItemSubmit={handleItemSubmit}
        onItemSaveAndContinue={handleItemSaveAndContinue}
      />

      {/* 提出・削除確認ダイアログ */}
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
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogAction(null)}
      />

      {/* ワークフロー操作確認ダイアログ（承認・却下・支払完了） */}
      <ConfirmDialog
        open={workflowDialogAction !== null}
        title={
          workflowDialogAction === 'approve'
            ? 'このレポートを承認しますか？'
            : workflowDialogAction === 'reject'
              ? 'このレポートを却下しますか？'
              : 'このレポートの支払完了を記録しますか？'
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
                }
              : undefined
        }
        onConfirm={handleWorkflowDialogConfirm}
        onCancel={() => setWorkflowDialogAction(null)}
      />

      {/* 明細削除確認ダイアログ */}
      <ConfirmDialog
        open={deletingItemId !== null}
        title="この明細を削除しますか？"
        message="この操作は取り消せません。"
        confirmLabel="削除する"
        confirmColor="error"
        cancelLabel="キャンセル"
        onConfirm={handleDeleteItemConfirm}
        onCancel={() => setDeletingItemId(null)}
      />
    </Box>
  );
}
