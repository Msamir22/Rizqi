import { DeleteConfirmationModal } from "@/components/modals/DeleteConfirmationModal";
import { PeriodFilterModal } from "@/components/modals/PeriodFilterModal";
import { TypeFilterModal } from "@/components/modals/TypeFilterModal";
import { RecurringEditModal } from "@/components/modals/RecurringEditModal";
import { AppDrawer } from "@/components/navigation/AppDrawer";
import { QuickEditModal } from "@/components/transactions/QuickEditModal";
import { IconLibrary } from "@/components/common/CategoryIcon";
import { GroupHeader } from "@/components/transactions/GroupHeader";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { TransferCard } from "@/components/transactions/TransferCard";
import { useToast } from "@/components/ui/Toast";
import { darkTheme, lightTheme, palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { PERIOD_LABELS } from "@/hooks/usePeriodSummary";
import { useTransactionOperations } from "@/hooks/useTransactionOperations";
import {
  GroupingPeriod,
  TransactionTypeFilter,
  useTransactionsGrouping,
} from "@/hooks/useTransactionsGrouping";
import { useSync } from "@/providers/SyncProvider";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { updateTransaction, updateTransfer } from "@/utils/transactions";
import * as Haptics from "expo-haptics";
export default function TransactionsPlaceholder() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  // Header height for dynamic padding
  const [headerHeight, setHeaderHeight] = useState(200);

  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const theme = isDark ? darkTheme : lightTheme;

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

  const handleRefresh = async () => {
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
  const handleUpdateTransaction = async (val: string | number) => {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      showToast({
        type: "success",
        title: "Updated",
        message: "Transaction updated successfully",
      });
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to update transaction",
      });
    }
  };

  // Selection Handlers
  const handleLongPress = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handlePress = (id: string) => {
    if (isSelectionMode) {
      handleLongPress(id); // Toggle selection
    } else {
      // TODO: Navigate to details?
      console.log("View details for", id);
    }
  };

  const handleSwipeDelete = async (id: string) => {
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

  const handleRecurringOption = (scope: "THIS" | "TEMPLATE") => {
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

  const handleCategoryPress = (id: string) => {
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

  const handleAmountPress = (id: string) => {
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

  const handleSelectAll = () => {
    // Flatten all transactions to get IDs
    const allIds = groupedData.flatMap((g) => g.transactions.map((t) => t.id));
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set()); // Deselect all
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleDeleteSelected = () => {
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
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
  const handleTypeToggle = (type: TransactionTypeFilter) => {
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
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        {/* Background */}
        <LinearGradient
          colors={theme.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Stars/Dots Layer (Simulated with simple views or image - Skipping for pure code now, 
          using gradient is cleaner. User mockup had stars, we can add later if requested component exists) */}

        {/* Header Section */}
        <View
          className="absolute top-0 left-0 right-0 bg-slate-50 dark:bg-slate-950 px-5 pb-3 z-10"
          style={{ paddingTop: insets.top + 16 }}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height !== headerHeight) {
              setHeaderHeight(height);
            }
          }}
        >
          <View className="flex-row justify-between items-center mb-4 h-10">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setIsDrawerOpen(true)}
                className="mr-3"
              >
                <Ionicons
                  name="menu-outline"
                  size={30}
                  color={isDark ? "#f8fafc" : "#1e293b"}
                />
              </TouchableOpacity>
              <Text className="text-3xl font-extrabold text-slate-800 dark:text-slate-50">
                Transactions
              </Text>
            </View>

            {isSelectionMode && (
              <View className="flex-row items-center">
                <TouchableOpacity onPress={handleSelectAll} className="mr-4">
                  <Text className="text-nileGreen-500 dark:text-nileGreen-400 font-semibold text-base">
                    Select All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteSelected}>
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color={palette.red[500]}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Filters */}
          <View>
            <View className="flex-row mb-3 flex-wrap gap-2">
              {/* Period Filter Button */}
              <TouchableOpacity
                className="flex-row items-center bg-slate-100 dark:bg-slate-800 py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-slate-700 gap-2 flex-1"
                onPress={() => {
                  console.log("Period button pressed");
                  setPeriodModalVisible(true);
                }}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color={
                    isDark ? palette.nileGreen[400] : palette.nileGreen[600]
                  }
                />
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
                  {PERIOD_LABELS[period]}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={isDark ? palette.slate[400] : palette.slate[500]}
                />
              </TouchableOpacity>

              {/* Type Filter Button */}
              <TouchableOpacity
                className="flex-row items-center bg-slate-100 dark:bg-slate-800 py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-slate-700 gap-2 flex-1"
                onPress={() => setTypeModalVisible(true)}
              >
                <Ionicons
                  name="filter"
                  size={16}
                  color={
                    isDark ? palette.nileGreen[400] : palette.nileGreen[600]
                  }
                />
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
                  {selectedTypes.length === 3
                    ? "All Types"
                    : selectedTypes.length === 0
                      ? "No Types"
                      : selectedTypes.join(", ")}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={isDark ? palette.slate[400] : palette.slate[500]}
                />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View className="mt-1">
              <View className="bg-slate-100 dark:bg-slate-900 flex-row items-center px-3 h-12 rounded-xl border border-slate-200 dark:border-slate-800">
                <Ionicons
                  name="search"
                  size={16}
                  color={isDark ? palette.slate[500] : palette.slate[400]}
                />
                <TextInput
                  className="flex-1 ml-2.5 text-slate-800 dark:text-slate-100 text-[15px]"
                  placeholder="Search transactions..."
                  placeholderTextColor={
                    isDark ? palette.slate[600] : palette.slate[400]
                  }
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={isDark ? palette.slate[500] : palette.slate[400]}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
                    onAmountPress={handleAmountPress}
                    // Transfers usually don't have categories to edit
                  />
                );
              }
              return (
                <TransactionCard
                  id={item.id}
                  amount={item.amount}
                  currency={item.currency}
                  date={item.date}
                  isExpense={item.isExpense}
                  isIncome={item.isIncome}
                  merchant={item.merchant}
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
                  onSwipeDelete={handleSwipeDelete}
                  onCategoryPress={handleCategoryPress}
                  onAmountPress={handleAmountPress}
                />
              );
            }}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{
              paddingTop: headerHeight,
              paddingBottom: 100,
            }}
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
      <AppDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
