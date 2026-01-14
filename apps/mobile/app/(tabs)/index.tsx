import { AccountsCarousel } from "@/components/dashboard/AccountsCarousel";
import { LiveRates } from "@/components/dashboard/LiveRates";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { TopNav } from "@/components/dashboard/TopNav";
import { TotalNetWorthCard } from "@/components/dashboard/TotalNetWorthCard";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/ui";
import { useTopAccounts } from "@/hooks/useAccounts";
import { useAssetBreakdown } from "@/hooks/useAssetBreakdown";
import { useMarketRates } from "@/hooks/useMarketRates";
import { useNetWorth } from "@/hooks/useNetWorthSummary";
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useDatabaseReady } from "@/providers/DatabaseProvider";
import { currencyToEGP } from "@astik/logic";
import React from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

export default function DashboardScreen(): React.JSX.Element {
  const isDbReady = useDatabaseReady();
  const { accounts, isLoading: accountsLoading } = useTopAccounts(3);
  const { rates, previousDayRates, isLoading: ratesLoading } = useMarketRates();
  const { breakdown, isLoading: breakdownLoading } = useAssetBreakdown();
  const { transactions, isLoading: transactionsLoading } =
    useRecentTransactions();

  const {
    netWorth,
    monthlyPercentageChange,
    isLoading: netWorthLoading,
  } = useNetWorth();

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
          <TopNav />
          <TotalNetWorthCard
            totalEgp={netWorth}
            totalUsd={
              netWorth && rates ? currencyToEGP(netWorth, rates.usd_egp) : null
            }
            monthlyPercentageChange={monthlyPercentageChange}
            isLoading={isLoading}
          />
          <LiveRates
            rates={rates}
            previousDayRates={previousDayRates}
            isLoading={ratesLoading}
          />
          <AccountsCarousel
            accounts={accounts}
            assetBreakdown={breakdown}
            isLoading={accountsLoading || breakdownLoading}
          />
          <RecentTransactions
            transactions={transactions}
            isLoading={transactionsLoading}
          />
        </View>
      </ScrollView>
    </StarryBackground>
  );
}
