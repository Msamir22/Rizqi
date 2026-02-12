import {
  AmountDisplay,
  formatWithCommas,
} from "@/components/add-transaction/AmountDisplay";
import {
  CalculatorKey,
  CalculatorKeypad,
} from "@/components/add-transaction/CalculatorKeypad";
import { CategoryPicker } from "@/components/add-transaction/CategoryPicker";
import { OptionalSection } from "@/components/add-transaction/OptionalSection";
import { TransferFields } from "@/components/add-transaction/TransferFields";
import { TypeTabs } from "@/components/add-transaction/TypeTabs";
import { CategoryIcon, IconLibrary } from "@/components/common/CategoryIcon";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { AccountSelectorModal } from "@/components/modals/AccountSelectorModal";
import {
  validateTransactionForm,
  type TransactionValidationErrors,
} from "@/validation/transaction-validation";
import { CategorySelectorModal } from "@/components/modals/CategorySelectorModal";
import { PageHeader } from "@/components/navigation/PageHeader";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, useCategory } from "@/hooks/useCategories";
import { useCategoryChildren } from "@/hooks/useCategoryChildren";
import { useMarketRates } from "@/hooks/useMarketRates";
import { createTransaction } from "@/hooks/useTransactions";
import { createRecurringPayment, createTransfer } from "@/utils/transactions";
import type { RecurringFrequency, TransactionType } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AddTransaction(): React.ReactNode {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { accounts } = useAccounts();

  const [type, setType] = useState<TransactionType | "TRANSFER">("EXPENSE");
  const [amount, setAmount] = useState<string>("");
  const [targetAmount, setTargetAmount] = useState<string>("");

  // Selection State
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>(""); // For Transfer
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Optional Fields
  const [counterparty, setCounterparty] = useState<string | undefined>(
    undefined
  );
  const [note, setNote] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringName, setRecurringName] = useState("");
  const [recurringFrequency, setRecurringFrequency] =
    useState<RecurringFrequency>("MONTHLY");
  const [recurringAutoCreate, setRecurringAutoCreate] = useState(false);

  // UI State
  const [isOptionalExpanded, setIsOptionalExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<TransactionValidationErrors>({});
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeAmountField, setActiveAmountField] = useState<
    "amount" | "targetAmount"
  >("amount");
  const { isDark } = useTheme();

  // Hooks
  const {
    expenseCategories,
    incomeCategories,
    isLoading: _categoriesLoading,
  } = useCategories();
  const { latestRates } = useMarketRates();

  // Derived Values
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const relevantCategories =
    type === "EXPENSE" ? expenseCategories : incomeCategories;

  // Use useCategory hook for display — supports L2/L3 categories
  // that are not in the root-level categories list
  const { category: selectedCategory } = useCategory(
    selectedCategoryId || null
  );

  // For income: when only 1 L1 category, fetch its L2 children for chips
  const singleIncomeL1Id =
    type === "INCOME" && incomeCategories.length === 1
      ? incomeCategories[0].id
      : null;
  const { children: incomeL2Children } = useCategoryChildren(singleIncomeL1Id);

  // Categories to show in chips: income L2 when only 1 L1, otherwise L1
  const chipCategories = useMemo(() => {
    if (singleIncomeL1Id && incomeL2Children.length > 0) {
      return incomeL2Children;
    }
    return relevantCategories;
  }, [singleIncomeL1Id, incomeL2Children, relevantCategories]);

  // Categories to pass as root to the modal
  const modalRootCategories = relevantCategories;

  const hasAccounts = accounts.length > 0;
  const canTransfer = accounts.length >= 2;

  // Initialize Defaults
  useEffect(() => {
    if (!hasAccounts || selectedAccountId) return;

    // It's safe to use the non-null assertion operator (!)
    // because we've already checked that accounts.length > 0
    const firstAccount = accounts.at(0)!;
    setSelectedAccountId(firstAccount.id);

    if (accounts.length > 1) {
      // For transfer destination, pick different account if possible
      const otherAccount = accounts.at(1)!;
      setToAccountId(otherAccount.id);
    }
  }, [accounts, selectedAccountId, hasAccounts]);

  // Track the previous type to only auto-reset category on type change.
  // Without this, selecting L2/L3 categories resets to L1 because
  // the effect would validate against the L1-only relevantCategories.
  const prevTypeRef = useRef(type);

  useEffect(() => {
    if (relevantCategories.length === 0) return;

    const typeChanged = prevTypeRef.current !== type;
    prevTypeRef.current = type;

    // Auto-select first category when: no selection yet, or type just changed
    if (!selectedCategoryId || typeChanged) {
      setSelectedCategoryId(relevantCategories[0].id);
    }

    // Reset keypad target to main amount when switching away from TRANSFER
    if (typeChanged && type !== "TRANSFER") {
      setActiveAmountField("amount");
    }
  }, [relevantCategories, selectedCategoryId, type]);

  // Calculator Logic
  const handleKeyPress = async (key: CalculatorKey): Promise<void> => {
    // Clear amount error on interaction
    if (formErrors.amount) {
      setFormErrors((prev) => ({ ...prev, amount: undefined }));
    }

    if (key === "DONE") {
      await handleSave();
      return;
    }

    // Determine which setter to use based on active field
    const isTargetField = activeAmountField === "targetAmount";
    const currentValue = isTargetField ? targetAmount : amount;
    const setValue = isTargetField ? setTargetAmount : setAmount;

    if (key === "=") {
      const result = calculateResult(currentValue);
      if (result !== 0 || currentValue.length > 0) {
        const formatted = parseFloat(result.toFixed(10)).toString();
        setValue(formatted);
      }
      return;
    }

    if (key === "DEL") {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    // Operator keys: +, -, *, /
    const isOperator = ["+", "-", "*", "/"].includes(key);

    setValue((prev) => {
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

  // Convert amount logic
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

  // Auto-calculate target amount for transfers
  useEffect(() => {
    if (
      type === "TRANSFER" &&
      selectedAccount &&
      toAccount &&
      amount &&
      selectedAccount.currency !== toAccount.currency
    ) {
      const numAmount = calculateResult(amount);
      if (numAmount > 0) {
        const rate = latestRates?.getRate(
          selectedAccount.currency,
          toAccount.currency
        );
        if (rate) {
          setTargetAmount((numAmount * rate).toFixed(2));
        }
      }
    }
  }, [type, selectedAccount, toAccount, amount, latestRates]);

  // Handle Save
  const handleSave = async (): Promise<void> => {
    // Clear previous errors
    setFormErrors({});

    // Build form data for validation
    const formData =
      type === "TRANSFER"
        ? { amount, fromAccountId: selectedAccountId, toAccountId }
        : {
            amount,
            accountId: selectedAccountId,
            categoryId: selectedCategoryId,
          };

    const { isValid, errors } = validateTransactionForm(type, formData);
    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    const finalAmount = calculateResult(amount);

    setIsSubmitting(true);
    try {
      if (type === "TRANSFER") {
        if (!toAccountId) {
          setFormErrors({ toAccountId: "Please select a destination account" });
          setIsSubmitting(false);
          return;
        }

        if (!selectedAccount) {
          setFormErrors({ fromAccountId: "Please select source account" });
          setIsSubmitting(false);
          return;
        }

        await createTransfer({
          amount: finalAmount,
          currency: selectedAccount.currency,
          fromAccountId: selectedAccountId,
          toAccountId,
          date,
          notes: note,
          convertedAmount: targetAmount ? parseFloat(targetAmount) : undefined,
          exchangeRate:
            targetAmount && finalAmount
              ? parseFloat(targetAmount) / finalAmount
              : undefined,
        });
      } else {
        let linkedRecurringId: string | undefined;

        if (isRecurring && recurringName) {
          const recurring = await createRecurringPayment({
            name: recurringName,
            amount: finalAmount,
            type,
            accountId: selectedAccountId,
            categoryId: selectedCategoryId,
            frequency: recurringFrequency,
            startDate: date,
            action: recurringAutoCreate ? "AUTO_CREATE" : "NOTIFY",
          });
          linkedRecurringId = recurring.id;
        }

        if (!selectedAccount) {
          setFormErrors({ accountId: "Please select an account" });
          setIsSubmitting(false);
          return;
        }

        await createTransaction({
          amount: finalAmount,
          currency: selectedAccount.currency,
          categoryId: selectedCategoryId,
          counterparty,
          accountId: selectedAccountId,
          note,
          source: "MANUAL",
          type,
          date,
          linkedRecurringId,
        });
      }
      router.back();
    } catch (error) {
      console.error(error);
      // Error is already logged above; validation errors are shown inline
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <PageHeader
        title="New Transaction"
        showBackButton={true}
        backIcon="arrow"
        rightAction={{
          label: "Save",
          onPress: handleSave,
          loading: isSubmitting,
        }}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Type Tabs */}
        <View className="mt-4">
          <TypeTabs selectedType={type} onSelect={setType} />
        </View>

        {/* Amount Display — hidden when transfer has no valid accounts */}
        {!(type === "TRANSFER" && !canTransfer) && (
          <>
            <AmountDisplay
              amount={amount}
              currency={selectedAccount?.currency || "EGP"}
              type={type}
              mainColor={selectedCategory?.color}
              onPress={
                isOptionalExpanded
                  ? () => setIsOptionalExpanded(false)
                  : activeAmountField === "targetAmount"
                    ? () => setActiveAmountField("amount")
                    : undefined
              }
            />
            {formErrors.amount && (
              <Text className="text-red-500 text-xs font-medium text-center mt-1">
                {formErrors.amount}
              </Text>
            )}
            {/* Insufficient balance warning */}
            {type === "EXPENSE" &&
              selectedAccount &&
              amount &&
              !isNaN(parseFloat(amount)) &&
              parseFloat(amount) > selectedAccount.balance && (
                <Text className="text-amber-500 text-xs font-medium text-center mt-1">
                  ⚠️ This will put your balance at -
                  {formatWithCommas(
                    (parseFloat(amount) - selectedAccount.balance).toFixed(2)
                  )}{" "}
                  {selectedAccount.currency}
                </Text>
              )}
          </>
        )}

        {/* Form Content */}
        <View className="px-6 mt-2">
          {type === "TRANSFER" ? (
            canTransfer ? (
              <TransferFields
                accounts={accounts}
                fromAccountId={selectedAccountId}
                toAccountId={toAccountId}
                onSelectFrom={setSelectedAccountId}
                onSelectTo={setToAccountId}
                amount={amount}
                targetAmount={targetAmount}
                onChangeTargetAmount={setTargetAmount}
                exchangeRate={
                  selectedAccount && toAccount
                    ? latestRates?.getRate(
                        selectedAccount.currency,
                        toAccount.currency
                      )
                    : undefined
                }
                isTargetAmountActive={activeAmountField === "targetAmount"}
                onFocusTargetAmount={() => setActiveAmountField("targetAmount")}
              />
            ) : (
              <View className="flex-1 items-center justify-center py-16">
                <EmptyStateCard
                  onPress={() => router.push("/add-account")}
                  icon="swap-horizontal-outline"
                  title="Need one more account"
                  description="Add another account to make transfers"
                  height={160}
                  borderRadius={20}
                  className="w-full"
                />
              </View>
            )
          ) : (
            <>
              <View className="flex-row gap-4 mb-4">
                {/* Account Field */}
                <View className="flex-1">
                  <Text className="input-label">ACCOUNT</Text>
                  {hasAccounts ? (
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
                  ) : (
                    <EmptyStateCard
                      onPress={() => router.push("/add-account")}
                      icon="wallet-outline"
                      title="No accounts found"
                      description="Tap here to add one"
                      height={56}
                      borderRadius={16}
                      className="mt-0.5"
                    />
                  )}
                  {formErrors.accountId && (
                    <Text className="text-red-500 text-xs font-medium mt-1">
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
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2 bg-slate-100 dark:bg-slate-700/50"
                      style={{
                        backgroundColor: selectedCategory?.color
                          ? `${selectedCategory.color}20`
                          : undefined,
                      }}
                    >
                      {selectedCategory ? (
                        <CategoryIcon
                          iconName={selectedCategory.icon}
                          iconLibrary={
                            selectedCategory.iconLibrary as IconLibrary
                          }
                          size={18}
                          color={selectedCategory.color}
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
                    <Text className="text-red-500 text-xs font-medium mt-1">
                      {formErrors.categoryId}
                    </Text>
                  )}
                </View>
              </View>

              {/* Category Chips (2-row horizontal scroll grid) */}
              <CategoryPicker
                selectedCategory={selectedCategory}
                categories={chipCategories}
                onOpenPicker={() => setIsCategoryModalOpen(true)}
                onSelectCategory={(cat) => setSelectedCategoryId(cat.id)}
                hideMainSelector={true}
              />
            </>
          )}

          {/* Optional Section (expanded content) — hidden for transfers */}
          {type !== "TRANSFER" && isOptionalExpanded && (
            <OptionalSection
              expanded={isOptionalExpanded}
              onToggleExpand={() => setIsOptionalExpanded(false)}
              transactionType={type}
              fields={{
                counterparty,
                note,
                date,
                isRecurring,
                recurringName,
                recurringFrequency,
                recurringAutoCreate,
              }}
              onChange={(updates) => {
                if (updates.counterparty !== undefined)
                  setCounterparty(updates.counterparty);
                if (updates.note !== undefined) setNote(updates.note);
                if (updates.date !== undefined) setDate(updates.date);
                if (updates.isRecurring !== undefined)
                  setIsRecurring(updates.isRecurring);
                if (updates.recurringName !== undefined)
                  setRecurringName(updates.recurringName);
                if (updates.recurringFrequency !== undefined)
                  setRecurringFrequency(updates.recurringFrequency);
                if (updates.recurringAutoCreate !== undefined)
                  setRecurringAutoCreate(updates.recurringAutoCreate);
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* "Add more details" bar — hidden for transfers */}
      {type !== "TRANSFER" && !isOptionalExpanded && (
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
            Add more details
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
            className="ml-1"
          />
        </TouchableOpacity>
      )}

      {/* Keypad - Fixed at bottom */}
      {/* Hide keypad when optional section is expanded or when transfer has no accounts */}
      {!(type === "TRANSFER" && !canTransfer) && (
        <CalculatorKeypad
          onKeyPress={handleKeyPress}
          hide={isOptionalExpanded}
        />
      )}

      {/* Bottom spacer for safe area if keypad is hidden */}
      {isOptionalExpanded && <View style={{ height: insets.bottom }} />}

      {/* Modals */}
      <AccountSelectorModal
        visible={isAccountModalOpen}
        accounts={accounts}
        selectedId={selectedAccountId}
        onSelect={setSelectedAccountId}
        onClose={() => setIsAccountModalOpen(false)}
      />

      {type !== "TRANSFER" && (
        <CategorySelectorModal
          visible={isCategoryModalOpen}
          rootCategories={modalRootCategories}
          selectedId={selectedCategoryId}
          type={type}
          onSelect={setSelectedCategoryId}
          onClose={() => setIsCategoryModalOpen(false)}
        />
      )}
    </View>
  );
}
