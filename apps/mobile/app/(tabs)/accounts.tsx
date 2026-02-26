import {
  AccountCard,
  AccountTypeTabs,
  FilterType,
} from "@/components/accounts";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Button, ButtonVariant } from "@/components/ui/Button";
import { palette } from "@/constants/colors";
import { useAccounts } from "@/hooks";
import { useMarketRates } from "@/hooks/useMarketRates";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import type { CurrencyType } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactElement, useCallback, useMemo, useState } from "react";
import { FlatList, type ListRenderItem, Text, View } from "react-native";

/**
 * Renders a button for creating a new account.
 *
 * @param onPress - Callback invoked when the button is pressed
 * @param variant - Visual variant of the button (defaults to `"dashed"`)
 * @returns A view containing an "Add New Account" button that invokes `onPress` when tapped
 */
function AddAccountButton({
  onPress,
  variant = "dashed",
}: {
  onPress: () => void;
  variant?: ButtonVariant;
}): ReactElement {
  return (
    <View className="mx-5 mb-10">
      <Button
        variant={variant}
        icon="add"
        title="Add New Account"
        onPress={onPress}
        size="md"
      />
    </View>
  );
}

/**
 * Render a styled card displaying the total account balance alongside its currency code.
 *
 * @param balance - The numeric amount to display as the total balance.
 * @param currencyCode - The currency code used to label and format the displayed amount.
 * @returns A React element containing a card with the "Total Balance" label, the currency code, and the formatted balance.
 */
function TotalBalanceCard({
  balance,
  currencyCode,
}: {
  balance: number;
  currencyCode: CurrencyType;
}): ReactElement {
  return (
    <View className="p-6 rounded-3xl border-b-4 bg-white dark:bg-slate-800 border-nileGreen-600 dark:border-nileGreen-500 shadow-xl dark:shadow-none">
      <Text className="text-sm font-bold mb-1 text-slate-500 dark:text-slate-400 uppercase tracking-widest">
        Total Balance
      </Text>
      <Text className="text-3xl font-black text-slate-900 dark:text-white">
        {formatCurrency({ amount: balance, currency: currencyCode })}
      </Text>
    </View>
  );
}

/**
 * Render the Accounts screen with total balance, filter tabs, and a list of accounts.
 *
 * Shows a currency-aware total balance and account type tabs only when accounts exist,
 * provides actions to add a new account, and displays a contextual empty state when no accounts match the selected filter.
 *
 * @returns The React element representing the Accounts screen UI
 */
export default function Accounts(): ReactElement {
  const router = useRouter();
  const { latestRates } = useMarketRates();

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const { totalAccountsBalance, accounts } = useAccounts();
  const { preferredCurrency } = usePreferredCurrency();
  const isEmpty = accounts.length === 0;

  const filteredAccounts = useMemo(() => {
    if (selectedFilter === "ALL") return accounts;
    return accounts.filter((acc) => acc.type === selectedFilter);
  }, [accounts, selectedFilter]);

  const handleAddAccount = useCallback(() => {
    router.push("/add-account");
  }, [router]);

  const renderItem: ListRenderItem<(typeof filteredAccounts)[number]> =
    useCallback(
      ({ item }) => (
        <AccountCard
          account={item}
          latestRates={latestRates}
          onPress={() => {
            // TODO: Navigate to account details
          }}
        />
      ),
      [latestRates]
    );

  const keyExtractor = useCallback(
    (item: (typeof filteredAccounts)[number]) => item.id,
    []
  );

  const renderFooter = (): ReactElement => (
    <View>
      {filteredAccounts.length > 0 && (
        <AddAccountButton onPress={handleAddAccount} />
      )}
    </View>
  );

  const renderEmpty = (): ReactElement => (
    <View className="flex-1 items-center justify-center py-20 px-10">
      <View className="w-20 h-20 rounded-full items-center justify-center mb-6 bg-slate-100 dark:bg-slate-800">
        <Ionicons name="wallet-outline" size={40} color={palette.slate[400]} />
      </View>
      <Text className="text-lg font-bold text-center mb-2 text-slate-800 dark:text-white">
        {selectedFilter === "ALL"
          ? "No accounts yet"
          : `No ${selectedFilter.toLowerCase()} accounts`}
      </Text>
      <Text className="text-sm text-slate-400 text-center mb-10">
        {selectedFilter === "ALL"
          ? "Start tracking your wealth by adding your first account."
          : `You haven't added any ${selectedFilter.toLowerCase()} accounts yet.`}
      </Text>

      {selectedFilter === "ALL" && (
        <AddAccountButton onPress={handleAddAccount} variant="primary" />
      )}
    </View>
  );

  return (
    <View className="flex-1">
      <PageHeader
        title="Accounts"
        rightAction={{
          icon: "add",
          onPress: handleAddAccount,
        }}
      />

      {/* Total Balance Card */}
      {!isEmpty && (
        <View className="px-5 pb-6">
          <TotalBalanceCard
            balance={totalAccountsBalance}
            currencyCode={preferredCurrency}
          />
        </View>
      )}

      {/* Only show filter tabs if user has accounts */}
      {!isEmpty && (
        <AccountTypeTabs
          selectedFilter={selectedFilter}
          onSelectFilter={setSelectedFilter}
        />
      )}

      <FlatList
        data={filteredAccounts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow"
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}
