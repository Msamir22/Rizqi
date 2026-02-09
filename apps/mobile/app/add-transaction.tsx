import { TransactionType } from "@astik/db";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountSelector } from "@/components/add-transaction/AccountSelector";
import { AmountDisplay } from "@/components/add-transaction/AmountDisplay";
import {
  CalculatorKey,
  CalculatorKeypad,
} from "@/components/add-transaction/CalculatorKeypad";
import { CategoryPicker } from "@/components/add-transaction/CategoryPicker";
import { OptionalSection } from "@/components/add-transaction/OptionalSection";
import { TransferFields } from "@/components/add-transaction/TransferFields";
import { TypeTabs } from "@/components/add-transaction/TypeTabs";
import { PageHeader } from "@/components/navigation/PageHeader";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useMarketRates } from "@/hooks/useMarketRates";
import { createTransaction } from "@/hooks/useTransactions";
import { createRecurringPayment, createTransfer } from "@/utils/transactions";

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
  const [merchant, setMerchant] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringName, setRecurringName] = useState("");
  const [recurringAutoCreate, setRecurringAutoCreate] = useState(false);

  // UI State
  const [isOptionalExpanded, setIsOptionalExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const {
    categories,
    expenseCategories,
    incomeCategories,
    isLoading: _categoriesLoading,
  } = useCategories();
  const { latestRates } = useMarketRates();

  // Derived Values
  // Selected account should never be undefined, so we can safely use the non-null assertion operator (!)
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)!;
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const relevantCategories =
    type === "EXPENSE" ? expenseCategories : incomeCategories;
  const selectedCategory =
    categories.find((c) => c.systemName === selectedCategoryId) || null;

  // Initialize Defaults
  useEffect(() => {
    if (accounts.length === 0) {
      // TODO: Show Empty State with Add account button
      Alert.alert("No Accounts", "Please add an account to continue");
      return;
    }

    if (!selectedAccountId) {
      // It's safe to use the non-null assertion operator (!)
      // because we've already checked that accounts.length > 0
      const firstAccount = accounts.at(0)!;
      setSelectedAccountId(firstAccount.id);

      if (accounts.length > 1) {
        // For transfer destination, pick different account if possible
        const otherAccount = accounts.at(1)!;
        setToAccountId(otherAccount.id);
      }
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (relevantCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(relevantCategories[0].systemName);
    }
  }, [relevantCategories, selectedCategoryId, type]);

  // Calculator Logic
  const handleKeyPress = async (key: CalculatorKey): Promise<void> => {
    if (key === "DONE") {
      await handleSave();
      return;
    }

    if (key === "DEL") {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }

    // Simple handling - extensive calc logic can be added if needed
    // Just appending for now, could implement eval() for basic math
    setAmount((prev) => {
      // Prevent multiple decimals
      if (key === "." && prev.includes(".")) return prev;
      // Prevent check for operators if just creating simple string for now
      return prev + key;
    });
  };

  // Convert amount logic
  const calculateResult = (expr: string): number => {
    try {
      // simple eval replacement or use a math library
      // unsafe eval usage? For simple calc, minimal hygiene needed
      // Only allow digits  + - * / .
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
    const finalAmount = calculateResult(amount);

    if (finalAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount greater than 0");
      return;
    }

    if (!selectedAccountId) {
      Alert.alert("No Account", "Please select an account");
      return;
    }

    setIsSubmitting(true);
    try {
      if (type === "TRANSFER") {
        if (!toAccountId) {
          Alert.alert("No Destination", "Please select a destination account");
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
          // TODO: Get the Actual Exchange Rate Without calculation
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
            frequency: "MONTHLY", // TODO: Get from OptionalSection state if refined
            startDate: date,
            action: recurringAutoCreate ? "AUTO_CREATE" : "NOTIFY",
          });
          linkedRecurringId = recurring.id;
        }

        await createTransaction({
          amount: finalAmount,
          currency: selectedAccount.currency,
          categoryId: selectedCategoryId,
          merchant,
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
      Alert.alert("Error", "Failed to save transaction");
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

        {/* Amount Display */}
        <AmountDisplay
          amount={amount}
          currency={selectedAccount?.currency || "EGP"}
          type={type}
          mainColor={selectedCategory?.color}
        />

        {/* Form Content */}
        <View className="px-6 mt-2">
          {type === "TRANSFER" ? (
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
            />
          ) : (
            <>
              <AccountSelector
                accounts={accounts}
                selectedId={selectedAccountId}
                onSelect={setSelectedAccountId}
                label="ACCOUNT"
                mainColor={selectedCategory?.color}
              />

              <CategoryPicker
                selectedCategory={selectedCategory}
                categories={relevantCategories}
                onOpenPicker={() => {
                  // TODO: Open modal picker layout
                  // For now just toggle next available or dummy interaction
                  // In real implementation this opens a bottom sheet
                }}
                // Dummy recent categories for visual completeness till implemented
                recentCategories={relevantCategories.slice(0, 3)}
                onSelectRecent={(cat) => setSelectedCategoryId(cat.systemName)}
              />
            </>
          )}

          {/* Optional Section */}
          <OptionalSection
            expanded={isOptionalExpanded}
            onToggleExpand={() => setIsOptionalExpanded(!isOptionalExpanded)}
            fields={{
              merchant,
              note,
              date,
              isRecurring,
              recurringName,
              recurringFrequency: "MONTHLY", // default
              recurringAutoCreate,
            }}
            onChange={(updates) => {
              if (updates.merchant !== undefined) setMerchant(updates.merchant);
              if (updates.note !== undefined) setNote(updates.note);
              if (updates.date !== undefined) setDate(updates.date);
              if (updates.isRecurring !== undefined)
                setIsRecurring(updates.isRecurring);
              if (updates.recurringName !== undefined)
                setRecurringName(updates.recurringName);
              if (updates.recurringAutoCreate !== undefined)
                setRecurringAutoCreate(updates.recurringAutoCreate);
            }}
          />
        </View>
      </ScrollView>

      {/* Keypad - Fixed at bottom */}
      {/* Hide keypad when optional section is expanded to allow keyboard for text inputs */}
      <CalculatorKeypad onKeyPress={handleKeyPress} hide={isOptionalExpanded} />

      {/* Bottom spacer for safe area if keypad is hidden */}
      {isOptionalExpanded && <View style={{ height: insets.bottom }} />}
    </View>
  );
}
