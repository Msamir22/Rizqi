/**
 * Recurring Payments List Page
 * Full list of recurring payments with status filtering
 */

import { CategoryIcon } from "@/components/common/CategoryIcon";
import { getFrequencyLabel } from "@/components/modals/FrequencyPickerModal";
import { PageHeader } from "@/components/navigation/PageHeader";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { palette } from "@/constants/colors";
import { useCategoryLookup } from "@/context/CategoriesContext";
import { useTheme } from "@/context/ThemeContext";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useRecurringPayments } from "@/hooks/useRecurringPayments";
import { getDueText } from "@/utils/dateHelpers";
import { getPaymentIcon } from "@/utils/recurring-helpers";
import type {
  CurrencyType,
  RecurringPayment,
  RecurringStatus,
} from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Sub-Components
// =============================================================================

interface StatusTabsProps {
  readonly activeTab: RecurringStatus;
  readonly onTabChange: (tab: RecurringStatus) => void;
  readonly counts: Record<RecurringStatus, number>;
}

function StatusTabs({
  activeTab,
  onTabChange,
  counts,
}: StatusTabsProps): React.JSX.Element {
  const tabs: RecurringStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];

  return (
    <View className="flex-row mb-5 gap-2">
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onTabChange(tab)}
          className={`flex-1 py-2.5 rounded-2xl ${
            activeTab === tab
              ? "bg-nileGreen-500"
              : "bg-slate-200 dark:bg-slate-800"
          }`}
        >
          <Text
            className={`text-center text-sm font-bold ${
              activeTab === tab
                ? "text-white"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </Text>
          <Text
            className={`text-center text-[10px] font-medium mt-0.5 ${
              activeTab === tab
                ? "text-white/80"
                : "text-slate-500 dark:text-slate-500"
            }`}
          >
            {counts[tab]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface HeroSummaryProps {
  readonly next7Days: number;
  readonly thisMonth: number;
  readonly currencyCode: CurrencyType;
}

/**
 * Displays a compact summary of upcoming recurring payment amounts.
 *
 * Shows two labeled values — the total due in the next 7 days and the total due this month — formatted using the provided currency.
 *
 * @param next7Days - Total amount due within the next 7 days
 * @param thisMonth - Total amount due for the current month
 * @param currencyCode - Currency code used to format the displayed amounts
 * @returns A React element containing the summary card with two formatted monetary values
 */
function HeroSummary({
  next7Days,
  thisMonth,
  currencyCode,
}: HeroSummaryProps): React.JSX.Element {
  const { t } = useTranslation("transactions");

  return (
    <View className="rounded-3xl border p-6 mb-6 bg-white/60 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
      {/* Context label */}
      <Text className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-3 text-center">
        {t("upcoming_expenses")}
      </Text>

      <View className="flex-row">
        <View className="flex-1 items-center border-r border-slate-200 dark:border-slate-700 pe-4">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            {t("next_7_days")}
          </Text>
          <Text className="text-xl font-bold mt-1 text-red-500">
            {formatCurrency({ amount: next7Days, currency: currencyCode })}
          </Text>
        </View>
        <View className="flex-1 items-center ps-4">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            {t("this_month")}
          </Text>
          <Text className="text-xl font-bold mt-1 text-red-500">
            {formatCurrency({ amount: thisMonth, currency: currencyCode })}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface PaymentCardProps {
  readonly payment: RecurringPayment;
  readonly onPress: () => void;
}

function PaymentCard({
  payment,
  onPress,
}: PaymentCardProps): React.JSX.Element {
  const { isDark } = useTheme();
  const categoryMap = useCategoryLookup();
  const category = categoryMap.get(payment.categoryId);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center p-4 rounded-2xl border mb-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      {/* Icon */}
      <View
        className={`w-12 h-12 rounded-2xl items-center justify-center me-4 ${
          payment.isIncome
            ? "bg-nileGreen-500/10"
            : "bg-slate-100 dark:bg-slate-700/50"
        }`}
      >
        {category ? (
          <CategoryIcon
            iconName={category.iconConfig.iconName}
            iconLibrary={category.iconConfig.iconLibrary}
            color={category.iconConfig.iconColor}
            size={20}
          />
        ) : (
          <Ionicons
            name={getPaymentIcon(payment.name)}
            size={24}
            color={
              payment.isIncome
                ? palette.nileGreen[500]
                : isDark
                  ? palette.slate[300]
                  : palette.slate[600]
            }
          />
        )}
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text
          className="text-base font-bold text-slate-800 dark:text-white"
          numberOfLines={1}
        >
          {payment.name}
        </Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          <Text
            className={`text-xs font-medium ${
              payment.isOverdue
                ? "text-red-500/80 dark:text-red-400/80"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {getDueText(payment.nextDueDate)}
          </Text>
          <View className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <Text className="text-xs text-slate-400 dark:text-slate-500">
            {getFrequencyLabel(payment.frequency)}
          </Text>
        </View>
      </View>

      {/* Amount */}
      <Text
        className={`text-base font-extrabold ${
          payment.isIncome ? "text-nileGreen-500" : "text-red-500"
        }`}
      >
        {payment.isIncome ? "+" : "-"}
        {formatCurrency({ amount: payment.amount, currency: payment.currency })}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Screen
/**
 * Displays the Recurring Payments screen with a hero summary, status tabs, payment list or empty state, and a floating add button.
 *
 * @returns A JSX element rendering the Recurring Payments screen.
 */

export default function RecurringPaymentsScreen(): React.JSX.Element {
  const { t } = useTranslation("transactions");
  const insets = useSafeAreaInsets();
  const {
    filteredPayments,
    counts,
    next7DaysTotal,
    totalDueThisMonth,
    isLoading,
    statusFilter,
    setStatusFilter,
  } = useRecurringPayments();

  const { preferredCurrency } = usePreferredCurrency();

  const handlePaymentPress = (_payment: RecurringPayment): void => {
    // TODO: Navigate to edit payment screen
  };

  const renderPaymentItem = useCallback(
    ({ item }: { item: RecurringPayment }) => (
      <PaymentCard payment={item} onPress={() => handlePaymentPress(item)} />
    ),
    []
  );

  const keyExtractor = useCallback((item: RecurringPayment) => item.id, []);

  return (
    <View className="flex-1">
      <PageHeader
        title={t("my_bills")}
        showBackButton={true}
        showDrawer={false}
      />

      <View className="flex-1 px-5 pt-4">
        {/* Hero Summary */}
        <HeroSummary
          next7Days={next7DaysTotal}
          thisMonth={totalDueThisMonth}
          currencyCode={preferredCurrency}
        />

        {/* Status Tabs */}
        <StatusTabs
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
          counts={counts}
        />

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={palette.nileGreen[500]} />
          </View>
        ) : filteredPayments.length === 0 ? (
          <EmptyStateCard
            onPress={() => router.push("/create-recurring-payment")}
            icon="receipt-outline"
            title={t("no_status_payments", {
              status: statusFilter.toLowerCase(),
            })}
            description={t("tap_to_add_recurring")}
            height={120}
          />
        ) : (
          <FlatList
            data={filteredPayments}
            keyExtractor={keyExtractor}
            renderItem={renderPaymentItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}

        {/* FAB - Add New */}
        <TouchableOpacity
          onPress={() => router.push("/create-recurring-payment")}
          className="absolute end-5 bg-nileGreen-500 w-14 h-14 rounded-full items-center justify-center"
          // eslint-disable-next-line react-native/no-inline-styles
          style={{
            bottom: insets.bottom + 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
