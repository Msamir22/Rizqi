import { palette } from "@/constants/colors";
import { RecentTransactionsSkeleton } from "@/components/dashboard/skeletons/RecentTransactionsSkeleton";
import { useCategoryLookup } from "@/context/CategoriesContext";
import { formatTransactionDate } from "@/utils/transactions";
import { Category, Transaction } from "@rizqi/db";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CategoryIcon } from "../common/CategoryIcon";
import { EmptyStateCard } from "../ui/EmptyStateCard";

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading: boolean;
}

interface TransactionItemProps {
  transaction: Transaction;
  isLast: boolean;
  category?: Category;
}

function TransactionItem({
  transaction,
  isLast,
  category,
}: TransactionItemProps): React.JSX.Element {
  const isExpense = transaction.isExpense;
  const { t } = useTranslation("common");

  // Use category's iconConfig or fallback to default icons
  const iconConfig = category?.iconConfig ?? {
    iconName: isExpense ? "cart" : "wallet",
    iconLibrary: "Ionicons" as const,
    iconColor: isExpense ? palette.red[500] : palette.nileGreen[500],
  };

  const handlePress = useCallback((): void => {
    router.push(`/edit-transaction?id=${transaction.id}`);
  }, [transaction.id]);

  return (
    <View>
      <TouchableOpacity
        className="flex-row items-center py-3"
        onPress={handlePress}
      >
        {/* Icon Circle */}
        <View
          className={`me-3 h-10 w-10 items-center justify-center rounded-full ${
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
            {transaction.counterparty ||
              category?.displayName ||
              t("transaction_fallback")}
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
          {transaction.signedFormatedAmount}
        </Text>
      </TouchableOpacity>

      {/* Separator */}
      {!isLast && (
        <View className="ms-[52px] h-[1px] bg-slate-200 dark:bg-white/10" />
      )}
    </View>
  );
}

function RecentTransactionsComponent({
  transactions,
  isLoading = false,
}: RecentTransactionsProps): React.JSX.Element {
  const categoryMap = useCategoryLookup();
  const { t } = useTranslation("common");

  const handleSeeAll = useCallback((): void => {
    router.push("/(tabs)/transactions");
  }, []);

  const handleAddTransaction = useCallback((): void => {
    router.push("/add-transaction");
  }, []);

  if (isLoading && transactions.length === 0) {
    return <RecentTransactionsSkeleton />;
  }

  return (
    <View className="my-4">
      {/* Header */}
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Text className="header-text">{t("recent_transactions")}</Text>
        <TouchableOpacity onPress={handleSeeAll}>
          <Text className="text-sm font-medium text-nileGreen-500">
            {t("see_all")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <EmptyStateCard
          onPress={handleAddTransaction}
          icon="receipt-outline"
          title={t("no_transactions_yet")}
          description={t("tap_to_add")}
        />
      ) : (
        <View className="rounded-3xl border p-4 mb-5 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
          {transactions.map((transaction, index) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              isLast={index === transactions.length - 1}
              category={categoryMap.get(transaction.categoryId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export const RecentTransactions = React.memo(RecentTransactionsComponent);
