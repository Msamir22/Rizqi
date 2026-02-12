import { IconLibrary } from "@/components/common/CategoryIcon";
import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { PeriodFilterModal } from "@/components/modals/PeriodFilterModal";
import { RecurringEditModal } from "@/components/modals/RecurringEditModal";
import { TypeFilterModal } from "@/components/modals/TypeFilterModal";
import { PageHeader } from "@/components/navigation/PageHeader";
import { GroupHeader } from "@/components/transactions/GroupHeader";
import { QuickEditModal } from "@/components/transactions/QuickEditModal";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { TransferCard } from "@/components/transactions/TransferCard";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { PERIOD_LABELS } from "@/hooks/usePeriodSummary";
import { useTransactionOperations } from "@/hooks/useTransactionOperations";
import {
  GroupingPeriod,
  TransactionTypeFilter,
  useTransactionsGrouping,
} from "@/hooks/useTransactionsGrouping";
import { useSync } from "@/providers/SyncProvider";
import { updateTransaction, updateTransfer } from "@/utils/transactions";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function TransactionsPlaceholder(): React.JSX.Element {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState<GroupingPeriod>("this_month");
  const [selectedTypes, setSelectedTypes] = useState<TransactionTypeFilter[]>([
    "Income",
    "Expense",
    "Transfer",
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // Data Hook - now accepts array of selected types directly
  const { groupedData, isLoading, refetch } = useTransactionsGrouping(
    period,
    selectedTypes,
    searchQuery
  );

  // Transaction Operations Hook
  const { deleteTransactions } = useTransactionOperations();

  // Sync Hook
  const { sync } = useSync();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await sync();
    // Also trigger local refetch just in case
    refetch();
    setIsRefreshing(false);
  };

  // Toast Hook
  const { showToast } = useToast();

  // Quick Edit State
  const [quickEdit, setQuickEdit] = useState<{
    visible: boolean;
    type: "CATEGORY" | "AMOUNT";
    transactionId: string;
    initialValue?: string | number;
    transactionType?: "INCOME" | "EXPENSE" | "TRANSFER";
    currency?: string;
    color?: string;
  }>({ visible: false, type: "CATEGORY", transactionId: "" });

  // Update handlers
  const handleUpdateTransaction = async (
    val: string | number
  ): Promise<void> => {
    const { transactionId, type: editType, transactionType } = quickEdit;

    try {
      if (transactionType === "TRANSFER") {
        // Transfer Update
        if (editType === "AMOUNT") {
          await updateTransfer(transactionId, { amount: Number(val) });
        }
      } else {
        // Transaction Update
        if (editType === "AMOUNT") {
          await updateTransaction(transactionId, { amount: Number(val) });
        } else {
          await updateTransaction(transactionId, { categoryId: String(val) });
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      showToast({
        type: "success",
        title: "Updated",
        message: "Transaction updated successfully",
      });
    } catch (e) {
      console.error(e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to update transaction",
      });
    }
  };

  // Selection Handlers
  const handleLongPress = (id: string): void => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handlePress = (id: string): void => {
    if (isSelectionMode) {
      handleLongPress(id); // Toggle selection
    } else {
      // TODO: Navigate to details?
      console.log("View details for", id);
    }
  };

  const handleSwipeDelete = async (id: string): Promise<void> => {
    // Find item to confirm type? Or just delete?
    // Usually swipe to delete asks for confirmation or undo.
    // For now, let's just delete (or maybe triggering the modal is better UX?)
    // User requested "Swipe Actions", let's do direct delete with Toast Undo ideally, but specific req wasn't Undo.
    // Let's call the delete function directly.
    const allTransactions = groupedData.flatMap((g) => g.transactions);
    const item = allTransactions.find((t) => t.id === id);
    if (item) {
      await deleteTransactions([item]);
      refetch();
    }
  };

  // Recurring Edit Modal State
  const [recurringEditModal, setRecurringEditModal] = useState<{
    visible: boolean;
    transactionId: string;
    action: "CATEGORY" | "AMOUNT";
  }>({
    visible: false,
    transactionId: "",
    action: "CATEGORY",
  });

  const handleRecurringOption = (scope: "THIS" | "TEMPLATE"): void => {
    const { transactionId, action } = recurringEditModal;
    setRecurringEditModal((prev) => ({ ...prev, visible: false }));

    const item = groupedData
      .flatMap((g) => g.transactions)
      .find((t) => t.id === transactionId);

    if (!item) return;

    if (scope === "TEMPLATE") {
      // For now, if they choose template, we might want to navigate to the recurring edit screen
      // OR allow quick edit but apply to template logic.
      // Given the complexity of "Edit Template" via a quick edit modal (which is specific to this instance's amount/cat),
      // for "TEMPLATE", we should probably navigate to the Recurring Payment Edit screen or show a toast "Not implemented".
      // But per plan "Edit this and update template".
      // Let's just proceed with Quick Edit for now, but we'd need to pass a flag to updateTransaction?
      // updateTransaction doesn't support updating the RecurringPayment template yet.
      // So for scope "TEMPLATE", let's redirect to full edit or just allow "THIS" for now?
      // The user prompt only asked for the WARNING.
      // Let's clear the modal and open the Quick Edit, but ideally we passed "scope".
      // Since QuickEditModal handles a single transaction update, "Edit Template" implies logic change.
      // Let's just proceed to Quick Edit for both, but maybe show a Toast for Template saying "Updating template..."
      // actually, let's keep it simple: "Edit Only This" opens Quick Edit. "Edit Template" could navigate to recurring list.
      // But to be helpful, let's open Quick Edit for "THIS".
      // For "TEMPLATE", let's show "Coming soon" or navigate.
      // A better approach for P0 is ensuring they don't ACCIDENTALLY change template.
      // So checking "Edit This" allows proceeding.
      showToast({
        type: "info",
        title: "Info",
        message: "Editing template is not yet supported in Quick Edit",
      });
    } else {
      // Proceed with Quick Edit for "THIS" instance
      if (item._type === "transaction") {
        if (action === "CATEGORY") {
          setQuickEdit({
            visible: true,
            type: "CATEGORY",
            transactionId,
            initialValue: item.categoryId || "other",
            transactionType: item.isIncome ? "INCOME" : "EXPENSE",
          });
        } else {
          setQuickEdit({
            visible: true,
            type: "AMOUNT",
            transactionId,
            initialValue: item.amount,
            transactionType: item.isIncome ? "INCOME" : "EXPENSE",
            currency: item.currency,
            color: item.isIncome ? palette.nileGreen[500] : palette.red[500],
          });
        }
      }
    }
  };

  const handleCategoryPress = (id: string): void => {
    const item = groupedData
      .flatMap((g) => g.transactions)
      .find((t) => t.id === id);
    if (!item) return;

    if (item._type === "transaction") {
      if (item.linkedRecurringId) {
        setRecurringEditModal({
          visible: true,
          transactionId: id,
          action: "CATEGORY",
        });
        return;
      }

      setQuickEdit({
        visible: true,
        type: "CATEGORY",
        transactionId: id,
        initialValue: item.categoryId,
        transactionType: item.isIncome ? "INCOME" : "EXPENSE",
      });
    }
  };

  const handleAmountPress = (id: string): void => {
    const item = groupedData
      .flatMap((g) => g.transactions)
      .find((t) => t.id === id);
    if (!item) return;

    if (item._type === "transaction") {
      if (item.linkedRecurringId) {
        setRecurringEditModal({
          visible: true,
          transactionId: id,
          action: "AMOUNT",
        });
        return;
      }

      setQuickEdit({
        visible: true,
        type: "AMOUNT",
        transactionId: id,
        initialValue: item.amount,
        transactionType: item.isIncome ? "INCOME" : "EXPENSE",
        currency: item.currency,
        color: item.isIncome ? palette.nileGreen[500] : palette.red[500],
      });
    } else if (item._type === "transfer") {
      setQuickEdit({
        visible: true,
        type: "AMOUNT",
        transactionId: id,
        initialValue: item.amount,
        transactionType: "TRANSFER",
        currency: item.currency,
        color: palette.blue[500],
      });
    }
  };

  const handleSelectAll = (): void => {
    // Flatten all transactions to get IDs
    const allIds = groupedData.flatMap((g) => g.transactions.map((t) => t.id));
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set()); // Deselect all
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleDeleteSelected = (): void => {
    setDeleteModalVisible(true);
  };

  const confirmDelete = async (): Promise<void> => {
    const ids = Array.from(selectedIds);
    const allTransactions = groupedData.flatMap((g) => g.transactions);
    const selectedItems = allTransactions.filter((item) =>
      ids.includes(item.id)
    );

    const success = await deleteTransactions(selectedItems);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedIds(new Set());
      refetch();
      showToast({
        type: "success",
        title: "Deleted Successfully",
        message: `${selectedItems.length} transaction${selectedItems.length > 1 ? "s" : ""} deleted successfully`,
      });
    }
  };

  // Type Filter Toggle Handler
  const handleTypeToggle = (type: TransactionTypeFilter): void => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  return (
    <>
      <View className="flex-1 bg-background dark:bg-background-dark">
        {/* Header Section */}
        <PageHeader
          title="Transactions"
          selectionMode={
            isSelectionMode
              ? {
                  count: selectedIds.size,
                  totalCount: groupedData.flatMap((g) => g.transactions).length,
                  onClear: () => setSelectedIds(new Set()),
                  onSelectAll: handleSelectAll,
                  onDelete: handleDeleteSelected,
                }
              : undefined
          }
          rightAction={
            isSelectionMode
              ? undefined
              : {
                  icon: "add",
                  onPress: () => router.push("/add-transaction"),
                }
          }
        />

        {/* Filters & Search Row */}

        <View className="px-5 pb-4">
          <View className="flex-row mb-3 flex-wrap gap-2">
            {/* Period Filter Button */}
            <TouchableOpacity
              className="flex-row items-center bg-white dark:bg-slate-800 py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-slate-700 gap-2 flex-1 shadow-sm"
              onPress={() => setPeriodModalVisible(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
              />
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
                {PERIOD_LABELS[period]}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={isDark ? palette.slate[500] : palette.slate[400]}
              />
            </TouchableOpacity>

            {/* Type Filter Button */}
            <TouchableOpacity
              className="flex-row items-center bg-white dark:bg-slate-800 py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-slate-700 gap-2 flex-1 shadow-sm"
              onPress={() => setTypeModalVisible(true)}
            >
              <Ionicons
                name="funnel-outline"
                size={18}
                color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
              />
              <Text
                className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1"
                numberOfLines={1}
              >
                {selectedTypes.length === 3
                  ? "All Types"
                  : selectedTypes.length === 0
                    ? "No Types"
                    : selectedTypes.join(", ")}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={isDark ? palette.slate[500] : palette.slate[400]}
              />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="bg-white dark:bg-slate-900 flex-row items-center px-4 h-12 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Ionicons
              name="search-outline"
              size={20}
              color={isDark ? palette.slate[500] : palette.slate[400]}
            />
            <TextInput
              className="flex-1 ml-3 text-slate-800 dark:text-slate-100 text-[16px]"
              placeholder="Search transactions..."
              placeholderTextColor={palette.slate[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={isDark ? palette.slate[500] : palette.slate[400]}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List Content */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={palette.nileGreen[500]} />
          </View>
        ) : groupedData.length === 0 ? (
          <View className="flex-1 justify-center items-center px-6">
            <View className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-6">
              <Ionicons
                name="receipt-outline"
                size={48}
                color={isDark ? palette.slate[600] : palette.slate[400]}
              />
            </View>
            <Text className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">
              No transactions yet
            </Text>
            <Text className="text-base text-slate-500 dark:text-slate-400 text-center mb-8">
              Start tracking your spending by adding your first transaction.
            </Text>
            <Button
              title="Add Transaction"
              onPress={() => router.push("/add-transaction")}
            />
          </View>
        ) : (
          <SectionList
            sections={groupedData.map((g) => ({
              title: g.title,
              netWorth: g.groupNetWorth,
              income: g.groupTotalIncome,
              expense: g.groupTotalExpense,
              data: g.transactions,
            }))}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({
              section: { title, netWorth, income, expense },
            }) => (
              <GroupHeader
                title={title}
                netWorth={netWorth || 0}
                income={income}
                expense={expense}
              />
            )}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            renderItem={({ item, index }) => {
              if (item._type === "transfer") {
                return (
                  <TransferCard
                    id={item.id}
                    amount={item.amount}
                    currency={item.currency}
                    date={item.date}
                    fromAccountName={item.fromAccountName}
                    toAccountName={item.toAccountName}
                    notes={item.notes}
                    displayNetWorth={item.displayNetWorth}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(item.id)}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    index={index}
                    onSwipeDelete={handleSwipeDelete}
                  />
                );
              }
              return (
                <TransactionCard
                  id={item.id}
                  signedAmount={item.signedAmount}
                  currency={item.currency}
                  date={item.date}
                  isExpense={item.isExpense}
                  isIncome={item.isIncome}
                  counterparty={item.counterparty}
                  note={item.note}
                  source={item.source}
                  accountName={item.accountName}
                  categoryName={item.categoryName}
                  categoryIconName={item.categoryIconName}
                  categoryIconLibrary={item.categoryIconLibrary as IconLibrary}
                  displayNetWorth={item.displayNetWorth}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(item.id)}
                  onPress={handlePress}
                  onLongPress={handleLongPress}
                  index={index}
                  // Delete Transfer should have different logic
                  // onSwipeDelete={handleSwipeDelete}
                  onCategoryPress={handleCategoryPress}
                  onAmountPress={handleAmountPress}
                />
              );
            }}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={deleteModalVisible}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
        count={selectedIds.size}
      />

      {/* Quick Edit Modal */}
      {/* Need to import QuickEditModal at top */}
      <QuickEditModal
        visible={quickEdit.visible}
        type={quickEdit.type}
        transactionType={quickEdit.transactionType || "EXPENSE"}
        initialCategoryId={
          quickEdit.type === "CATEGORY"
            ? String(quickEdit.initialValue)
            : undefined
        }
        initialAmount={
          quickEdit.type === "AMOUNT"
            ? Number(quickEdit.initialValue)
            : undefined
        }
        currency={quickEdit.currency}
        amountColor={quickEdit.color}
        onClose={() => setQuickEdit((prev) => ({ ...prev, visible: false }))}
        onSave={handleUpdateTransaction}
      />

      {/* Filter Modals */}
      <PeriodFilterModal
        visible={periodModalVisible}
        selectedPeriod={period}
        onSelect={setPeriod}
        onClose={() => setPeriodModalVisible(false)}
      />
      <TypeFilterModal
        visible={typeModalVisible}
        selectedTypes={selectedTypes}
        onToggle={handleTypeToggle}
        onClose={() => setTypeModalVisible(false)}
      />

      <RecurringEditModal
        visible={recurringEditModal.visible}
        onEditThis={() => handleRecurringOption("THIS")}
        onEditTemplate={() => handleRecurringOption("TEMPLATE")}
        onCancel={() =>
          setRecurringEditModal((prev) => ({ ...prev, visible: false }))
        }
      />
    </>
  );
}
