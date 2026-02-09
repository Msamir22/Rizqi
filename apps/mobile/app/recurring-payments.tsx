/**
 * Recurring Payments List Page
 * Full list of recurring payments with status filtering
 */

import { StarryBackground } from "@/components/ui/StarryBackground";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { database, RecurringPayment } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { Ionicons } from "@expo/vector-icons";
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
  const { isDark } = useTheme();
  const tabs: StatusFilter[] = ["ACTIVE", "PAUSED", "COMPLETED"];

  return (
    <View className="flex-row mb-5">
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onTabChange(tab)}
          className={`flex-1 py-2 rounded-xl mr-2 last:mr-0 ${
            activeTab === tab
              ? "bg-nileGreen-500"
              : isDark
                ? "bg-slate-800"
                : "bg-slate-200"
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              activeTab === tab
                ? "text-white"
                : isDark
                  ? "text-slate-400"
                  : "text-slate-600"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()} ({counts[tab]})
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
  const { isDark } = useTheme();
  const containerClass = isDark
    ? "bg-slate-800/70 border-slate-700"
    : "bg-white/70 border-slate-200";

  return (
    <View className={`rounded-2xl border p-4 mb-5 ${containerClass}`}>
      <View className="flex-row">
        <View className="flex-1 items-center border-r border-slate-600/30 pr-4">
          <Text
            className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Next 7 days
          </Text>
          <Text
            className={`text-xl font-bold mt-1 ${isDark ? "text-white" : "text-slate-800"}`}
          >
            {formatCurrency(next7Days, "EGP")}
          </Text>
        </View>
        <View className="flex-1 items-center pl-4">
          <Text
            className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            This Month
          </Text>
          <Text
            className={`text-xl font-bold mt-1 ${isDark ? "text-white" : "text-slate-800"}`}
          >
            {formatCurrency(thisMonth, "EGP")}
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

  const containerClass = isDark
    ? "bg-slate-800/50 border-slate-700"
    : "bg-white border-slate-200";

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-xl border mb-3 ${containerClass}`}
    >
      {/* Icon */}
      <View
        className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
          isIncome ? "bg-nileGreen-500/20" : "bg-slate-700/50"
        }`}
      >
        <Ionicons
          name={getPaymentIcon(payment.name)}
          size={24}
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
          className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-800"}`}
          numberOfLines={1}
        >
          {payment.name}
        </Text>
        <Text
          className={`text-sm ${
            isOverdue
              ? "text-red-400"
              : isDark
                ? "text-slate-400"
                : "text-slate-500"
          }`}
        >
          {getDueText(payment.nextDueDate)}
        </Text>
      </View>

      {/* Amount */}
      <Text
        className={`text-base font-bold ${
          isIncome
            ? "text-nileGreen-500"
            : isDark
              ? "text-white"
              : "text-slate-800"
        }`}
      >
        {isIncome ? "+" : ""}
        {formatCurrency(payment.amount, "EGP")}
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
    <StarryBackground>
      <View className="flex-1 px-5" style={{ paddingTop: insets.top + 10 }}>
        {/* Header */}
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "white" : palette.slate[800]}
            />
          </TouchableOpacity>
          <Text
            className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-800"}`}
          >
            My Bills
          </Text>
        </View>

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
    </StarryBackground>
  );
}
