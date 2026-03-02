import { CurrencyPicker } from "@/components/currency/CurrencyPicker";
import { AccountsSection } from "@/components/dashboard/AccountsSection";
import { LiveRates } from "@/components/dashboard/LiveRates";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ThisMonth } from "@/components/dashboard/ThisMonth";
import { TopNav } from "@/components/dashboard/TopNav";
import { TotalNetWorthCard } from "@/components/dashboard/TotalNetWorthCard";
import { UpcomingPayments } from "@/components/dashboard/UpcomingPayments";
import { AppDrawer } from "@/components/navigation/AppDrawer";
import { SmsPermissionPrompt } from "@/components/sms-sync/SmsPermissionPrompt";
import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/ui";
import { useTopAccounts } from "@/hooks/useAccounts";
import { useMarketRates } from "@/hooks/useMarketRates";
import { useMonthlyPercentageChange, useNetWorth } from "@/hooks/useNetWorth";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useSmsPermission } from "@/hooks/useSmsPermission";
import { useSmsSync } from "@/hooks/useSmsSync";
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useDatabaseReady } from "@/providers/DatabaseProvider";
import type { CurrencyType } from "@astik/db";
import { CURRENCY_INFO_MAP } from "@astik/logic";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

/**
 * Renders the main dashboard screen including total net worth, live market rates, top accounts,
 * recent transactions, upcoming payments, and UI for selecting the preferred currency.
 *
 * @returns The dashboard screen React element.
 */
export default function DashboardScreen(): React.JSX.Element {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState(false);
  const isDbReady = useDatabaseReady();
  const { accounts, isLoading: accountsLoading } = useTopAccounts(3);
  const {
    latestRates,
    previousDayRate,
    isLoading: ratesLoading,
    lastUpdated,
    isStale,
  } = useMarketRates();
  const { transactions, isLoading: transactionsLoading } =
    useRecentTransactions(3);

  const {
    totalNetWorth,
    totalNetWorthUsd,
    isLoading: netWorthLoading,
  } = useNetWorth();
  const { monthlyPercentageChange } = useMonthlyPercentageChange();
  const {
    preferredCurrency,
    setPreferredCurrency,
    isLoading: isCurrencyLoading,
  } = usePreferredCurrency();

  const currencyInfo = CURRENCY_INFO_MAP[preferredCurrency];

  // SMS sync prompt
  const router = useRouter();
  const { shouldShowPrompt, dismissPrompt } = useSmsSync();
  const { requestPermission } = useSmsPermission();

  const handleCurrencySelect = useCallback(
    (currency: CurrencyType) => {
      if (isCurrencyLoading) return;
      setPreferredCurrency(currency).catch(console.error);
    },
    [setPreferredCurrency, isCurrencyLoading]
  );

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
          <TopNav
            onMenuPress={() => setIsDrawerOpen(true)}
            currencyCode={preferredCurrency}
            currencyFlag={currencyInfo?.flag}
            onCurrencyPress={() =>
              !isCurrencyLoading && setIsCurrencyPickerOpen(true)
            }
            isCurrencyLoading={isCurrencyLoading}
          />
          <TotalNetWorthCard
            totalNetWorth={totalNetWorth}
            totalNetWorthUsd={totalNetWorthUsd}
            preferredCurrency={preferredCurrency}
            monthlyPercentageChange={monthlyPercentageChange}
            isLoading={isLoading}
          />
          <LiveRates
            latestRates={latestRates}
            previousDayRate={previousDayRate}
            isLoading={ratesLoading}
            lastUpdated={lastUpdated}
            isStale={isStale}
            preferredCurrency={preferredCurrency}
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
      <CurrencyPicker
        visible={!isCurrencyLoading && isCurrencyPickerOpen}
        selectedCurrency={preferredCurrency}
        onSelect={handleCurrencySelect}
        onClose={() => setIsCurrencyPickerOpen(false)}
      />
      <SmsPermissionPrompt
        visible={shouldShowPrompt}
        onPermissionGranted={() => {
          dismissPrompt().catch(() => {});
          router.push("/sms-scan");
        }}
        onDismiss={() => {
          dismissPrompt().catch(() => {});
        }}
        requestPermission={requestPermission}
      />
    </StarryBackground>
  );
}
