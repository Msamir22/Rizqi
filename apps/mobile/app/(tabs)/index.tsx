import { AccountsSection } from "@/components/dashboard/AccountsSection";
import { LiveRates } from "@/components/dashboard/LiveRates";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ThisMonth } from "@/components/dashboard/ThisMonth";
import { UpcomingPayments } from "@/components/dashboard/UpcomingPayments";
import { TopNav } from "@/components/dashboard/TopNav";
import { TotalNetWorthCard } from "@/components/dashboard/TotalNetWorthCard";
import { AppDrawer } from "@/components/navigation/AppDrawer";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/ui";
import { useTopAccounts } from "@/hooks/useAccounts";
import { useMarketRates } from "@/hooks/useMarketRates";
import { useNetWorthWithMonthlyPercentageChange } from "@/hooks/useNetWorth";
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useDatabaseReady } from "@/providers/DatabaseProvider";
import { egpToCurrency } from "@astik/logic";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

export default function DashboardScreen(): React.JSX.Element {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDbReady = useDatabaseReady();
  const { accounts, isLoading: accountsLoading } = useTopAccounts(3);
  const {
    latestRate,
    previousDayRate,
    isLoading: ratesLoading,
    lastUpdated,
    isStale,
  } = useMarketRates();
  const { transactions, isLoading: transactionsLoading } =
    useRecentTransactions(3);

  const {
    totalNetWorth,
    monthlyPercentageChange,
    isLoading: netWorthLoading,
  } = useNetWorthWithMonthlyPercentageChange();

  // Overall loading state
  const isLoading = accountsLoading || ratesLoading || netWorthLoading;

  // Show loading state until database is ready
  if (!isDbReady) {
    return (
      <StarryBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={palette.nileGreen[500]} />
        </View>
      </StarryBackground>
    );
  }

  return (
    <StarryBackground>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-[10px]">
          <TopNav onMenuPress={() => setIsDrawerOpen(true)} />
          <TotalNetWorthCard
            totalEgp={totalNetWorth}
            totalUsd={
              totalNetWorth && latestRate
                ? egpToCurrency(totalNetWorth, latestRate.usdEgp)
                : null
            }
            monthlyPercentageChange={monthlyPercentageChange}
            isLoading={isLoading}
          />
          <LiveRates
            latestRate={latestRate}
            previousDayRate={previousDayRate}
            isLoading={ratesLoading}
            lastUpdated={lastUpdated}
            isStale={isStale}
          />
          <AccountsSection accounts={accounts} isLoading={accountsLoading} />
          <ThisMonth />
          <UpcomingPayments />
          <RecentTransactions
            transactions={transactions}
            isLoading={transactionsLoading}
          />
        </View>
      </ScrollView>
      <AppDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </StarryBackground>
  );
}
