/**
 * Recurring Payments List Page
 * Full list of recurring payments with status filtering
 */

import { database, RecurringPayment } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "@/components/navigation/PageHeader";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// =============================================================================
// Types
// =============================================================================

type StatusFilter = "ACTIVE" | "PAUSED" | "COMPLETED";

interface PaymentWithRelations extends RecurringPayment {
  categoryName?: string;
  accountName?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getDueText(date: Date): string {
  const days = getDaysUntil(date);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function getPaymentIcon(name: string): keyof typeof Ionicons.glyphMap {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("netflix") || nameLower.includes("stream"))
    return "play-circle";
  if (nameLower.includes("spotify") || nameLower.includes("music"))
    return "musical-notes";
  if (nameLower.includes("gym") || nameLower.includes("fitness"))
    return "barbell";
  if (nameLower.includes("internet") || nameLower.includes("wifi"))
    return "wifi";
  if (nameLower.includes("electric") || nameLower.includes("power"))
    return "flash";
  if (nameLower.includes("water")) return "water";
  if (nameLower.includes("rent") || nameLower.includes("house")) return "home";
  if (nameLower.includes("salary") || nameLower.includes("income"))
    return "cash";
  if (nameLower.includes("phone") || nameLower.includes("mobile"))
    return "phone-portrait";
  return "receipt";
}

// =============================================================================
// Components
// =============================================================================

interface StatusTabsProps {
  activeTab: StatusFilter;
  onTabChange: (tab: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

function StatusTabs({
  activeTab,
  onTabChange,
  counts,
}: StatusTabsProps): React.JSX.Element {
  const tabs: StatusFilter[] = ["ACTIVE", "PAUSED", "COMPLETED"];

  return (
    <View className="flex-row mb-5">
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onTabChange(tab)}
          className={`flex-1 py-3 rounded-2xl mr-2 last:mr-0 ${
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
  next7Days: number;
  thisMonth: number;
}

function HeroSummary({
  next7Days,
  thisMonth,
}: HeroSummaryProps): React.JSX.Element {
  return (
    <View className="rounded-3xl border p-6 mb-6 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
      <View className="flex-row">
        <View className="flex-1 items-center border-r border-slate-200 dark:border-slate-700 pr-4">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            Next 7 days
          </Text>
          <Text className="text-xl font-bold mt-1 text-slate-800 dark:text-white">
            {formatCurrency({ amount: next7Days, currency: "EGP" })}
          </Text>
        </View>
        <View className="flex-1 items-center pl-4">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            This Month
          </Text>
          <Text className="text-xl font-bold mt-1 text-slate-800 dark:text-white">
            {formatCurrency({ amount: thisMonth, currency: "EGP" })}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface PaymentCardProps {
  payment: PaymentWithRelations;
  onPress: () => void;
}

function PaymentCard({
  payment,
  onPress,
}: PaymentCardProps): React.JSX.Element {
  const { isDark } = useTheme();
  const daysUntil = getDaysUntil(payment.nextDueDate);
  const isOverdue = daysUntil < 0;
  const isIncome = payment.type === "INCOME";

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center p-4 rounded-2xl border mb-3 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm"
    >
      {/* Icon */}
      <View
        className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
          isIncome ? "bg-nileGreen-500/10" : "bg-slate-100 dark:bg-slate-700/50"
        }`}
      >
        <Ionicons
          name={getPaymentIcon(payment.name)}
          size={24}
          className={
            isIncome
              ? "text-nileGreen-500"
              : "text-slate-600 dark:text-slate-300"
          }
          color={
            isIncome
              ? palette.nileGreen[500]
              : isDark
                ? palette.slate[300]
                : palette.slate[600]
          }
        />
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text
          className="text-base font-bold text-slate-800 dark:text-white"
          numberOfLines={1}
        >
          {payment.name}
        </Text>
        <Text
          className={`text-sm font-medium ${
            isOverdue
              ? "text-red-500/80 dark:text-red-400/80"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {getDueText(payment.nextDueDate)}
        </Text>
      </View>

      {/* Amount */}
      <Text
        className={`text-base font-extrabold ${
          isIncome ? "text-nileGreen-500" : "text-slate-800 dark:text-white"
        }`}
      >
        {isIncome ? "+" : ""}
        {formatCurrency({ amount: payment.amount, currency: "EGP" })}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function RecurringPaymentsScreen(): React.JSX.Element {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusFilter>("ACTIVE");

  useEffect(() => {
    const collection = database.get<RecurringPayment>("recurring_payments");
    const subscription = collection
      .query(Q.where("deleted", false), Q.sortBy("next_due_date", Q.asc))
      .observe()
      .subscribe({
        next: (result) => {
          setPayments(result as PaymentWithRelations[]);
          setIsLoading(false);
        },
        error: (err) => {
          console.error("Error loading recurring payments:", err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // Filter by status
  const filteredPayments = payments.filter((p) => p.status === activeTab);

  // Count by status
  const counts: Record<StatusFilter, number> = {
    ACTIVE: payments.filter((p) => p.status === "ACTIVE").length,
    PAUSED: payments.filter((p) => p.status === "PAUSED").length,
    COMPLETED: payments.filter((p) => p.status === "COMPLETED").length,
  };

  // Calculate summaries (only for active expenses)
  const activePayments = payments.filter(
    (p) => p.status === "ACTIVE" && p.type === "EXPENSE"
  );
  const today = new Date();
  const next7Days = activePayments
    .filter((p) => {
      const days = getDaysUntil(p.nextDueDate);
      return days >= 0 && days <= 7;
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const thisMonth = activePayments
    .filter((p) => {
      const dueDate = new Date(p.nextDueDate);
      return (
        dueDate.getMonth() === today.getMonth() &&
        dueDate.getFullYear() === today.getFullYear()
      );
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const handlePaymentPress = (payment: PaymentWithRelations): void => {
    // TODO: Navigate to edit payment
    console.log("Payment pressed:", payment.id);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="My Bills" showBackButton={true} showDrawer={false} />

      <View className="flex-1 px-5 pt-4">
        {/* Hero Summary */}
        <HeroSummary next7Days={next7Days} thisMonth={thisMonth} />

        {/* Status Tabs */}
        <StatusTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={counts}
        />

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={palette.nileGreen[500]} />
          </View>
        ) : filteredPayments.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Ionicons
              name="receipt-outline"
              size={48}
              color={isDark ? palette.slate[600] : palette.slate[300]}
            />
            <Text
              className={`mt-3 text-base ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              No {activeTab.toLowerCase()} payments
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPayments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PaymentCard
                payment={item}
                onPress={() => handlePaymentPress(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          />
        )}

        {/* FAB - Add New */}
        <TouchableOpacity
          onPress={() => router.push("/create-recurring-payment")}
          className="absolute right-5 bg-nileGreen-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
