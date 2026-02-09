import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactElement, useCallback, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
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

function TotalBalanceCard({ balance }: { balance: number }): ReactElement {
  return (
    <View className="p-6 rounded-3xl border-b-4 bg-white dark:bg-slate-800 border-nileGreen-600 dark:border-nileGreen-500 shadow-xl dark:shadow-none">
      <Text className="text-sm font-bold mb-1 text-slate-500 dark:text-slate-400 uppercase tracking-widest">
        Total Balance
      </Text>
      <View className="flex-row items-baseline">
        <Text className="text-sm font-extrabold text-nileGreen-500 mr-1.5">
          EGP
        </Text>
        <Text className="text-3xl font-black text-slate-900 dark:text-white">
          {balance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>
    </View>
  );
}

export default function Accounts(): ReactElement {
  const router = useRouter();
  const { latestRates } = useMarketRates();

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const { totalBalanceEgp, accounts } = useAccounts();

  const isEmpty = accounts.length === 0;

  const filteredAccounts = useMemo(() => {
    if (selectedFilter === "ALL") return accounts;
    return accounts.filter((acc) => acc.type === selectedFilter);
  }, [accounts, selectedFilter]);

  const handleAddAccount = useCallback(() => {
    router.push("/add-account");
  }, [router]);

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
    <View className="flex-1 bg-background dark:bg-background-dark">
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
          <TotalBalanceCard balance={totalBalanceEgp} />
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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AccountCard
            account={item}
            latestRates={latestRates}
            onPress={() => {
              // TODO: Navigate to account details
            }}
          />
        )}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </View>
  );
}
