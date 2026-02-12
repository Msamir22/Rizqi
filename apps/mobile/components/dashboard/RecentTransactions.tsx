import { palette } from "@/constants/colors";
import { useCategory } from "@/hooks/useCategories";
import { formatTransactionDate } from "@/utils/transactions";
import { Transaction } from "@astik/db";
import { router } from "expo-router";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CategoryIcon } from "../common/CategoryIcon";
import { EmptyStateCard } from "../ui/EmptyStateCard";

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading: boolean;
}

interface TransactionItemProps {
  transaction: Transaction;
  isLast: boolean;
}

function TransactionItem({
  transaction,
  isLast,
}: TransactionItemProps): React.JSX.Element {
  const { category } = useCategory(transaction.categoryId);
  const isExpense = transaction.isExpense;

  // Use category's iconConfig or fallback to default icons
  const iconConfig = category?.iconConfig ?? {
    iconName: isExpense ? "cart" : "wallet",
    iconLibrary: "Ionicons" as const,
    iconColor: isExpense ? palette.red[500] : palette.nileGreen[500],
  };

  return (
    <View>
      <TouchableOpacity className="flex-row items-center py-3">
        {/* Icon Circle */}
        <View
          className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${
            isExpense ? "bg-red-500/10" : "bg-nileGreen-500/10"
          }`}
        >
          <CategoryIcon
            iconName={iconConfig.iconName}
            iconLibrary={iconConfig.iconLibrary}
            size={18}
            color={isExpense ? palette.red[500] : palette.nileGreen[500]}
          />
        </View>

        {/* Text Info */}
        <View className="flex-1 gap-0.5">
          <Text className="text-[15px] font-semibold text-slate-800 dark:text-white">
            {transaction.counterparty || category?.displayName || "Transaction"}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {formatTransactionDate(transaction.date)}
          </Text>
        </View>

        {/* Amount */}
        <Text
          className={`text-[15px] font-semibold ${
            isExpense ? "text-red-500" : "text-nileGreen-500"
          }`}
        >
          {transaction.signedAmount}
        </Text>
      </TouchableOpacity>

      {/* Separator */}
      {!isLast && (
        <View className="ml-[52px] h-[1px] bg-slate-200 dark:bg-white/10" />
      )}
    </View>
  );
}

export function RecentTransactions({
  transactions,
  isLoading = false,
}: RecentTransactionsProps): React.JSX.Element {
  const handleSeeAll = (): void => {
    router.push("/(tabs)/transactions");
  };

  return (
    <>
      {/* Header */}
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Text className="header-text">Recent Transactions</Text>
        <TouchableOpacity onPress={handleSeeAll}>
          <Text className="text-sm font-medium text-nileGreen-500">
            See All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      {isLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="small" color={palette.nileGreen[500]} />
        </View>
      ) : transactions.length === 0 ? (
        <EmptyStateCard
          onPress={() => router.push("/add-transaction")}
          icon="receipt-outline"
          title="No transactions yet"
          description="Tap the + button to add one"
        />
      ) : (
        <View className="rounded-3xl border p-4 mb-5 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
          {transactions.map((transaction, index) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              isLast={index === transactions.length - 1}
            />
          ))}
        </View>
      )}
    </>
  );
}
