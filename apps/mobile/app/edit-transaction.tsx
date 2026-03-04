/**
 * Edit Transaction Screen
 *
 * Pre-populates form fields from an existing transaction and allows
 * editing amount, category, counterparty, note, date, type (EXPENSE ↔ INCOME),
 * and account (cross-currency allowed). Includes delete and discard modals.
 */

import { AmountDisplay } from "@/components/add-transaction/AmountDisplay";
import {
  type CalculatorKey,
  CalculatorKeypad,
} from "@/components/add-transaction/CalculatorKeypad";
import { OptionalSection } from "@/components/add-transaction/OptionalSection";
import { CategoryPicker } from "@/components/add-transaction/CategoryPicker";
import { TypeTabs } from "@/components/add-transaction/TypeTabs";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { AccountSelectorModal } from "@/components/modals/AccountSelectorModal";
import { CategorySelectorModal } from "@/components/modals/CategorySelectorModal";
import { PageHeader } from "@/components/navigation/PageHeader";
import { RecurringWarningBanner } from "@/components/transactions/RecurringWarningBanner";
import { palette } from "@/constants/colors";
import { useToast } from "@/components/ui/Toast";
import { useCategoryLookup } from "@/context/CategoriesContext";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryChildren } from "@/hooks/useCategoryChildren";
import { useTransactionById } from "@/hooks/useTransactionById";
import {
  convertTransactionToTransfer,
  deleteTransaction,
  updateTransaction,
} from "@/services/transaction-service";
import {
  validateTransactionForm,
  type TransactionValidationErrors,
} from "@/validation/transaction-validation";
import { Ionicons } from "@expo/vector-icons";
import type { TransactionType } from "@astik/db";
import { formatAmountInput } from "@astik/logic";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Android LayoutAnimation Enablement
// =============================================================================
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Types
// =============================================================================

interface OriginalValues {
  readonly amount: string;
  readonly type: TransactionType | "TRANSFER";
  readonly categoryId: string;
  readonly accountId: string;
  readonly counterparty: string | undefined;
  readonly note: string | undefined;
  readonly date: Date;
}

// =============================================================================
// Component
// =============================================================================

export default function EditTransaction(): React.ReactNode {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  // ---------------------------------------------------------------------------
  // Data Hooks
  // ---------------------------------------------------------------------------
  const { transaction, isLoading: isLoadingTx } = useTransactionById(id ?? "");
  const { accounts } = useAccounts();
  const { expenseCategories, incomeCategories } = useCategories();
  const categoryMap = useCategoryLookup();

  // ---------------------------------------------------------------------------
  // Form State
  // ---------------------------------------------------------------------------
  const [type, setTypeRaw] = useState<TransactionType | "TRANSFER">("EXPENSE");

  /** Wraps setType with LayoutAnimation for smooth form content swap */
  const setType = useCallback((next: TransactionType | "TRANSFER"): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTypeRaw(next);
  }, []);
  const [amount, setAmount] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [counterparty, setCounterparty] = useState<string | undefined>(
    undefined
  );
  const [note, setNote] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(new Date());

  // Transfer-conversion state (for type-switch to TRANSFER)
  const [toAccountId, setToAccountId] = useState<string>("");
  const [isToAccountModalOpen, setIsToAccountModalOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // UI State
  // ---------------------------------------------------------------------------
  const [isOptionalExpanded, setIsOptionalExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<TransactionValidationErrors>({});
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isConversionWarningOpen, setIsConversionWarningOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track original values for dirty checking
  const originalRef = useRef<OriginalValues | null>(null);

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedToAccount = accounts.find((a) => a.id === toAccountId);
  const isTransferMode = type === "TRANSFER";
  const relevantCategories =
    type === "EXPENSE" ? expenseCategories : incomeCategories;

  const selectedCategory = categoryMap.get(selectedCategoryId) ?? null;

  // Filter accounts for transfer: from/to cannot be the same
  const fromAccountOptions = accounts.filter((a) => a.id !== toAccountId);
  const toAccountOptions = accounts.filter((a) => a.id !== selectedAccountId);

  // Check for linked relationships (debt, asset, recurring)
  const hasLinkedRelationships =
    transaction?.linkedDebtId ||
    transaction?.linkedAssetId ||
    transaction?.linkedRecurringId;

  // For income: when only 1 L1 category, show L2 children as chips
  const singleIncomeL1Id =
    type === "INCOME" && incomeCategories.length === 1
      ? incomeCategories[0].id
      : null;
  const { children: incomeL2Children } = useCategoryChildren(singleIncomeL1Id);

  const chipCategories = useMemo(() => {
    if (singleIncomeL1Id && incomeL2Children.length > 0) {
      return incomeL2Children;
    }
    return relevantCategories;
  }, [singleIncomeL1Id, incomeL2Children, relevantCategories]);

  const modalRootCategories = relevantCategories;

  // ---------------------------------------------------------------------------
  // Initialize form from transaction
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!transaction || isInitialized) return;

    const amountStr = transaction.amount.toString();
    setAmount(amountStr);
    setTypeRaw(transaction.type);
    setSelectedAccountId(transaction.accountId);
    setSelectedCategoryId(transaction.categoryId);
    setCounterparty(transaction.counterparty);
    setNote(transaction.note);
    setDate(transaction.date);

    originalRef.current = {
      amount: amountStr,
      type: transaction.type,
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      counterparty: transaction.counterparty,
      note: transaction.note,
      date: transaction.date,
    };

    // Expand optional section if any optional fields have values
    if (transaction.counterparty || transaction.note) {
      setIsOptionalExpanded(true);
    }

    setIsInitialized(true);
  }, [transaction, isInitialized]);

  // ---------------------------------------------------------------------------
  // Dirty Checking
  // ---------------------------------------------------------------------------
  const isDirty = useMemo(() => {
    if (!originalRef.current) return false;
    const orig = originalRef.current;
    return (
      amount !== orig.amount ||
      type !== orig.type ||
      selectedCategoryId !== orig.categoryId ||
      selectedAccountId !== orig.accountId ||
      counterparty !== orig.counterparty ||
      note !== orig.note ||
      date.getTime() !== orig.date.getTime()
    );
  }, [
    amount,
    type,
    selectedCategoryId,
    selectedAccountId,
    counterparty,
    note,
    date,
  ]);

  // ---------------------------------------------------------------------------
  // Calculator Evaluation
  // ---------------------------------------------------------------------------
  const calculateResult = (expr: string): number => {
    try {
      // Only allow digits + - * / .
      if (!/^[0-9+\-*/.]+$/.test(expr)) return parseFloat(expr) || 0;
      // eslint-disable-next-line no-eval
      return eval(expr) as number;
    } catch {
      return 0;
    }
  };

  // ---------------------------------------------------------------------------
  // Handle Save
  // ---------------------------------------------------------------------------
  const handleSave = async (): Promise<void> => {
    if (isSubmitting || !transaction) return;

    const parsedAmount = calculateResult(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormErrors({ amount: "Please enter a valid amount" });
      return;
    }

    // --- Branch: Convert to Transfer ---
    if (isTransferMode) {
      if (!selectedAccountId) {
        setFormErrors({ accountId: "Select a source account" });
        return;
      }
      if (!toAccountId) {
        setFormErrors({ accountId: "Select a destination account" });
        return;
      }
      if (selectedAccountId === toAccountId) {
        setFormErrors({ accountId: "From and To accounts must be different" });
        return;
      }

      // Show linkage warning if applicable (T018)
      if (hasLinkedRelationships) {
        setIsConversionWarningOpen(true);
        return;
      }

      return executeConversion();
    }

    // --- Branch: Regular Transaction Update ---
    const { isValid, errors } = validateTransactionForm(type, {
      amount,
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
    });

    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await updateTransaction(transaction.id, {
        amount: parsedAmount,
        categoryId: selectedCategoryId,
        note: note || undefined,
        date,
        counterparty: counterparty || undefined,
        type,
        accountId: selectedAccountId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        console.error
      );
      showToast({ type: "success", title: "Transaction updated" });
      router.back();
    } catch (err) {
      console.error("[EditTransaction] Save error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        console.error
      );
      showToast({ type: "error", title: "Failed to save changes" });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Execute the Transaction→Transfer conversion.
   * Called directly when no linkage warning is needed,
   * or from the linkage warning modal on confirm.
   */
  const executeConversion = async (): Promise<void> => {
    if (isSubmitting || !transaction) return;

    setIsSubmitting(true);
    try {
      await convertTransactionToTransfer({
        transactionId: transaction.id,
        toAccountId,
        notes: note,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        console.error
      );
      showToast({ type: "success", title: "Converted to transfer" });
      router.back();
    } catch (err) {
      console.error("[EditTransaction] Conversion error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        console.error
      );
      showToast({ type: "error", title: "Failed to convert to transfer" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Calculator Key Handler
  // ---------------------------------------------------------------------------
  const handleKeyPress = (key: CalculatorKey): void => {
    // Clear amount error on interaction
    if (formErrors.amount) {
      setFormErrors((prev) => ({ ...prev, amount: undefined }));
    }

    if (key === "DONE") {
      handleSave().catch((err: unknown) =>
        console.error("[EditTransaction] Save failed:", err)
      );
      return;
    }

    if (key === "=") {
      const result = calculateResult(amount);
      if (result !== 0 || amount.length > 0) {
        const formatted = parseFloat(result.toFixed(10)).toString();
        setAmount(formatted);
      }
      return;
    }

    if (key === "DEL") {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }

    // Operator keys: +, -, *, /
    const isOperator = ["+", "-", "*", "/"].includes(key);

    setAmount((prev) => {
      // Prevent multiple decimals in the current number segment
      if (key === ".") {
        const lastOpIdx = Math.max(
          prev.lastIndexOf("+"),
          prev.lastIndexOf("-"),
          prev.lastIndexOf("*"),
          prev.lastIndexOf("/")
        );
        const currentSegment = prev.slice(lastOpIdx + 1);
        if (currentSegment.includes(".")) return prev;
      }

      // Prevent consecutive operators — replace the last one
      if (isOperator && prev.length > 0) {
        const lastChar = prev[prev.length - 1];
        if (["+", "-", "*", "/"].includes(lastChar)) {
          return prev.slice(0, -1) + key;
        }
      }

      // Prevent starting with an operator (except minus for negative)
      if (isOperator && prev.length === 0 && key !== "-") return prev;

      return prev + key;
    });
  };

  // ---------------------------------------------------------------------------
  // Handle Delete
  // ---------------------------------------------------------------------------
  const handleDelete = async (): Promise<void> => {
    if (!transaction) return;

    try {
      await deleteTransaction(transaction.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        console.error
      );
      showToast({ type: "success", title: "Transaction deleted" });
      router.back();
    } catch (err) {
      console.error("[EditTransaction] Delete error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        console.error
      );
      showToast({ type: "error", title: "Failed to delete transaction" });
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / Error States
  // ---------------------------------------------------------------------------
  if (isLoadingTx || !isInitialized) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={palette.nileGreen[500]} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-slate-500 dark:text-slate-400 text-center">
          Transaction not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 rounded-xl bg-nileGreen-500"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View className="flex-1">
      {/* Header */}
      <PageHeader
        title="Edit Transaction"
        showBackButton={true}
        backIcon="arrow"
        secondaryAction={{
          icon: "trash-outline",
          onPress: () => setIsDeleteModalOpen(true),
          color: palette.red[500],
        }}
        rightAction={{
          label: "Save",
          onPress: () => {
            handleSave().catch((err: unknown) =>
              console.error("[EditTransaction] Save failed:", err)
            );
          },
          loading: isSubmitting,
          disabled: !isDirty,
        }}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Recurring Warning */}
        {transaction.linkedRecurringId && (
          <RecurringWarningBanner recurringId={transaction.linkedRecurringId} />
        )}

        {/* Type Tabs (EXPENSE / INCOME / TRANSFER) */}
        <View className="mt-4">
          <TypeTabs selectedType={type} onSelect={setType} />
        </View>

        {/* Amount Display */}
        <>
          {/* Insufficient balance warning */}
          {type === "EXPENSE" &&
            selectedAccount &&
            amount &&
            !isNaN(parseFloat(amount)) &&
            parseFloat(amount) > selectedAccount.balance && (
              <Text className="text-amber-500 text-xs font-medium text-center mb-1">
                ⚠️ This will put your balance at -
                {formatAmountInput(
                  (parseFloat(amount) - selectedAccount.balance).toFixed(2),
                  "0"
                )}{" "}
                {selectedAccount.currency}
              </Text>
            )}
          <AmountDisplay
            amount={amount}
            currency={selectedAccount?.currency || "EGP"}
            type={type}
            mainColor={selectedCategory?.color}
            originalAmount={originalRef.current?.amount}
            onPress={
              isOptionalExpanded
                ? () => setIsOptionalExpanded(false)
                : undefined
            }
          />
          {formErrors.amount && (
            <Text className="text-red-500 text-xs font-medium text-center mt-1">
              {formErrors.amount}
            </Text>
          )}
        </>

        {/* Form Content */}
        <View className="px-6 mt-4">
          {isTransferMode ? (
            /* ---- Transfer Mode: From/To Account Selectors ---- */
            <>
              <View className="flex-row gap-4 mb-4">
                {/* From Account */}
                <View className="flex-1">
                  <Text className="input-label">FROM</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFormErrors((prev) => ({
                        ...prev,
                        accountId: undefined,
                      }));
                      setIsAccountModalOpen(true);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
                  >
                    <View className="w-8 h-8 rounded-xl items-center justify-center mr-2 bg-slate-100 dark:bg-slate-700/50">
                      <Ionicons
                        name={
                          selectedAccount?.type === "BANK"
                            ? "business-outline"
                            : selectedAccount?.type === "DIGITAL_WALLET"
                              ? "card-outline"
                              : "wallet-outline"
                        }
                        size={18}
                        color={isDark ? palette.slate[400] : palette.slate[500]}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
                    >
                      {selectedAccount?.name || "Select"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Swap Button */}
                <View className="justify-end pb-1">
                  <TouchableOpacity
                    onPress={() => {
                      const tempFrom = selectedAccountId;
                      setSelectedAccountId(toAccountId);
                      setToAccountId(tempFrom);
                    }}
                    className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center border border-slate-200 dark:border-slate-700"
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={20}
                      color={isDark ? palette.slate[400] : palette.slate[500]}
                    />
                  </TouchableOpacity>
                </View>

                {/* To Account */}
                <View className="flex-1">
                  <Text className="input-label">TO</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFormErrors((prev) => ({
                        ...prev,
                        accountId: undefined,
                      }));
                      setIsToAccountModalOpen(true);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
                  >
                    <View className="w-8 h-8 rounded-xl items-center justify-center mr-2 bg-slate-100 dark:bg-slate-700/50">
                      <Ionicons
                        name={
                          selectedToAccount?.type === "BANK"
                            ? "business-outline"
                            : selectedToAccount?.type === "DIGITAL_WALLET"
                              ? "card-outline"
                              : "wallet-outline"
                        }
                        size={18}
                        color={isDark ? palette.slate[400] : palette.slate[500]}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
                    >
                      {selectedToAccount?.name || "Select"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {formErrors.accountId && (
                <Text className="text-red-500 text-xs mt-1 mb-2">
                  {formErrors.accountId}
                </Text>
              )}
            </>
          ) : (
            /* ---- Transaction Mode: Single Account + Category ---- */
            <>
              <View className="flex-row gap-4 mb-4">
                {/* Account Field */}
                <View className="flex-1">
                  <Text className="input-label">ACCOUNT</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFormErrors((prev) => ({
                        ...prev,
                        accountId: undefined,
                      }));
                      setIsAccountModalOpen(true);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
                  >
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2 bg-slate-100 dark:bg-slate-700/50"
                      style={{
                        backgroundColor: selectedCategory?.color
                          ? `${selectedCategory.color}20`
                          : undefined,
                      }}
                    >
                      <Ionicons
                        name={
                          selectedAccount?.type === "BANK"
                            ? "business-outline"
                            : selectedAccount?.type === "DIGITAL_WALLET"
                              ? "card-outline"
                              : "wallet-outline"
                        }
                        size={18}
                        color={
                          selectedCategory?.color ||
                          (isDark ? palette.slate[400] : palette.slate[500])
                        }
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
                    >
                      {selectedAccount?.name || "Select"}
                    </Text>
                  </TouchableOpacity>
                  {formErrors.accountId && (
                    <Text className="text-red-500 text-xs mt-1">
                      {formErrors.accountId}
                    </Text>
                  )}
                </View>

                {/* Category Field */}
                <View className="flex-1">
                  <Text className="input-label">CATEGORY</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFormErrors((prev) => ({
                        ...prev,
                        categoryId: undefined,
                      }));
                      setIsCategoryModalOpen(true);
                    }}
                    activeOpacity={0.7}
                    className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
                  >
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2"
                      style={{
                        backgroundColor: selectedCategory?.color
                          ? `${selectedCategory.color}20`
                          : isDark
                            ? palette.slate[700]
                            : palette.slate[100],
                      }}
                    >
                      {selectedCategory?.icon ? (
                        <Ionicons
                          name={
                            selectedCategory.icon as keyof typeof Ionicons.glyphMap
                          }
                          size={18}
                          color={
                            selectedCategory.color ||
                            (isDark ? palette.slate[400] : palette.slate[500])
                          }
                        />
                      ) : (
                        <Ionicons
                          name="grid-outline"
                          size={18}
                          color={
                            isDark ? palette.slate[400] : palette.slate[500]
                          }
                        />
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
                    >
                      {selectedCategory?.displayName || "Select"}
                    </Text>
                  </TouchableOpacity>
                  {formErrors.categoryId && (
                    <Text className="text-red-500 text-xs mt-1">
                      {formErrors.categoryId}
                    </Text>
                  )}
                </View>
              </View>

              {/* Category Chips (shared component) */}
              <CategoryPicker
                selectedCategory={selectedCategory}
                categories={chipCategories}
                onOpenPicker={() => setIsCategoryModalOpen(true)}
                onSelectCategory={(cat) => setSelectedCategoryId(cat.id)}
                hideMainSelector={true}
              />
            </>
          )}

          {/* Optional Section — not shown in transfer mode */}
          {isOptionalExpanded && !isTransferMode && (
            <OptionalSection
              expanded={isOptionalExpanded}
              onToggleExpand={() => setIsOptionalExpanded(false)}
              transactionType={type}
              fields={{
                counterparty,
                note,
                date,
                isRecurring: false,
                recurringName: "",
                recurringFrequency: "MONTHLY" as const,
                recurringAutoCreate: false,
              }}
              onChange={(updates) => {
                if (updates.counterparty !== undefined)
                  setCounterparty(updates.counterparty);
                if (updates.note !== undefined) setNote(updates.note);
                if (updates.date !== undefined) setDate(updates.date);
              }}
              hideRecurring
            />
          )}
        </View>
      </ScrollView>

      {/* "More details" bar — hidden in transfer mode */}
      {!isOptionalExpanded && !isTransferMode && (
        <TouchableOpacity
          onPress={() => setIsOptionalExpanded(true)}
          className="flex-row items-center justify-center py-2 border-t border-slate-200 dark:border-slate-800"
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          />
          <Text className="ml-1.5 text-sm font-bold text-nileGreen-600 dark:text-nileGreen-400">
            More details
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
            className="ml-1"
          />
        </TouchableOpacity>
      )}

      {/* Keypad */}
      <CalculatorKeypad
        onKeyPress={handleKeyPress}
        hide={isOptionalExpanded}
        actionLabel="Save Changes"
      />

      {/* Safe area spacer when keypad hidden */}
      {isOptionalExpanded && <View style={{ height: insets.bottom }} />}

      {/* Modals */}
      <AccountSelectorModal
        visible={isAccountModalOpen}
        accounts={isTransferMode ? fromAccountOptions : accounts}
        selectedId={selectedAccountId}
        onSelect={setSelectedAccountId}
        onClose={() => setIsAccountModalOpen(false)}
      />

      {isTransferMode && (
        <AccountSelectorModal
          visible={isToAccountModalOpen}
          accounts={toAccountOptions}
          selectedId={toAccountId}
          onSelect={setToAccountId}
          onClose={() => setIsToAccountModalOpen(false)}
        />
      )}

      {!isTransferMode && (
        <CategorySelectorModal
          visible={isCategoryModalOpen}
          rootCategories={modalRootCategories}
          selectedId={selectedCategoryId}
          type={type}
          onSelect={setSelectedCategoryId}
          onClose={() => setIsCategoryModalOpen(false)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        visible={isDeleteModalOpen}
        onConfirm={() => {
          handleDelete().catch((err: unknown) =>
            console.error("[EditTransaction] Delete failed:", err)
          );
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
        title="Delete Transaction?"
        message="This will delete the transaction and revert all associated changes to account balances. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Discard Changes Confirmation */}
      <ConfirmationModal
        visible={isDiscardModalOpen}
        onConfirm={() => router.back()}
        onCancel={() => setIsDiscardModalOpen(false)}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        variant="warning"
        icon="alert-circle-outline"
      />

      {/* Linked Relationships Warning (T018) — shown when converting to Transfer */}
      <ConfirmationModal
        visible={isConversionWarningOpen}
        onConfirm={() => {
          setIsConversionWarningOpen(false);
          executeConversion().catch((err: unknown) =>
            console.error("[EditTransaction] Conversion failed:", err)
          );
        }}
        onCancel={() => setIsConversionWarningOpen(false)}
        title="Linked Data Warning"
        message={[
          "Converting to a transfer will affect linked data:",
          transaction?.linkedDebtId ? "• Linked debt record" : "",
          transaction?.linkedAssetId ? "• Linked asset record" : "",
          transaction?.linkedRecurringId ? "• Linked recurring payment" : "",
          "\nLinkages will be preserved on the original record for audit purposes.",
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="Convert Anyway"
        cancelLabel="Cancel"
        variant="warning"
        icon="link-outline"
      />
    </View>
  );
}
