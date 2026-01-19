import { palette } from "@/constants/colors";
import { useCategory } from "@/hooks/useCategories";
import { formatTransactionDate } from "@/utils/transactions";
import { Transaction } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CategoryIcon } from "../common/CategoryIcon";

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
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: isExpense
              ? `${palette.red[500]}20`
              : `${palette.nileGreen[500]}20`,
          }}
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
            {transaction.merchant || category?.displayName || "Transaction"}
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
          {isExpense ? "- " : "+ "}
          {transaction.currencySymbol}
          {Math.abs(transaction.amount).toLocaleString()}
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
      <View className="dark:rounded-2xl dark:bg-slate-800 dark:p-4">
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="small" color={palette.nileGreen[500]} />
          </View>
        ) : transactions.length === 0 ? (
          <View className="items-center py-8">
            <Ionicons
              name="receipt-outline"
              size={48}
              color={palette.slate[400]}
            />
            <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              No transactions yet
            </Text>
          </View>
        ) : (
          transactions.map((transaction, index) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              isLast={index === transactions.length - 1}
            />
          ))
        )}
      </View>
    </>
  );
}
