import { AccountSelector } from "@/components/add-transaction/AccountSelector";
import { AmountDisplay } from "@/components/add-transaction/AmountDisplay";
import {
  CalculatorKeypad,
  CalculatorKey,
} from "@/components/add-transaction/CalculatorKeypad";
import { CategoryPicker } from "@/components/add-transaction/CategoryPicker";
import { OptionalSection } from "@/components/add-transaction/OptionalSection";
import { TransferFields } from "@/components/add-transaction/TransferFields";
import { TypeTabs } from "@/components/add-transaction/TypeTabs";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useCategories } from "@/hooks/useCategories";
import { useMarketRates } from "@/hooks/useMarketRates";
import {
  createRecurringPayment,
  createTransaction,
  createTransfer,
} from "@/utils/transactions";
import { Account, database, TransactionType } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientBackground } from "../components/ui/GradientBackground";
import { Q } from "@nozbe/watermelondb";
import { withObservables } from "@nozbe/watermelondb/react";

interface AddTransactionProps {
  accounts: Account[];
}

function AddTransaction({ accounts }: AddTransactionProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const isDark = mode === "dark";

  // Form State
  const [type, setType] = useState<TransactionType | "TRANSFER">("EXPENSE");
  const [amount, setAmount] = useState<string>("");
  const [targetAmount, setTargetAmount] = useState<string>("");

  // Selection State
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>(""); // For Transfer
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Optional Fields
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
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
    isLoading: categoriesLoading,
  } = useCategories();
  const { latestRates } = useMarketRates();

  // Derived Values
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const relevantCategories =
    type === "EXPENSE" ? expenseCategories : incomeCategories;
  const selectedCategory =
    categories.find((c) => c.systemName === selectedCategoryId) || null;

  // Initialize Defaults
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const cashAccount = accounts.find((a) => a.type === "CASH");
      setSelectedAccountId(cashAccount ? cashAccount.id : accounts[0].id);

      // For transfer destination, pick different account if possible
      const otherAccount = accounts.find(
        (a) => a.id !== (cashAccount?.id || accounts[0].id)
      );
      if (otherAccount) setToAccountId(otherAccount.id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (relevantCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(relevantCategories[0].systemName);
    }
  }, [relevantCategories, selectedCategoryId, type]);

  // Calculator Logic
  const handleKeyPress = (key: CalculatorKey) => {
    if (key === "DONE") {
      handleSave();
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
      return eval(expr);
    } catch (e) {
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
  const handleSave = async () => {
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
          currency: selectedAccount?.currency || "EGP",
          fromAccountId: selectedAccountId,
          toAccountId: toAccountId,
          date,
          notes: note || undefined,
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
            type: type as TransactionType,
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
          currency: selectedAccount?.currency || "EGP",
          categoryId: selectedCategoryId,
          merchant: merchant || undefined,
          accountId: selectedAccountId,
          note: note || undefined,
          type: type as TransactionType,
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
    <GradientBackground style={{ flex: 1 }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-6 pb-2"
        style={{ paddingTop: insets.top + 16 }}
      >
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons
            name="close"
            size={28}
            color={isDark ? "#FFF" : palette.slate[900]}
          />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-slate-900 dark:text-white">
          New Transaction
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color={palette.nileGreen[500]} />
          ) : (
            <Text className="text-base font-bold text-nileGreen-600 dark:text-nileGreen-400">
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

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
          type={type as any}
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
    </GradientBackground>
  );
}

const enhance = withObservables([], () => ({
  accounts: database.get<Account>("accounts").query(Q.where("deleted", false)),
}));

export default enhance(AddTransaction);
