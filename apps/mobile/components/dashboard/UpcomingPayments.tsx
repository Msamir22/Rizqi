/**
 * UpcomingPayments Section - Dashboard upcoming bills preview
 *
 * Design: Option D - Featured payment + mini list + Pay Now
 * Shows: Next N payments regardless of month, with clear month labels
 * Features: Pay Now opens modal with editable amount, creates transaction directly
 */

import { palette } from "@/constants/colors";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/context/ThemeContext";
import { useAccounts } from "@/hooks/useAccounts";
import {
  UpcomingPayment,
  useUpcomingPayments,
} from "@/hooks/useUpcomingPayments";
import { createTransaction } from "@/utils/transactions";
import { database, RecurringPayment } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { router } from "expo-router";

// =============================================================================
// Types
// =============================================================================

interface PayNowModalProps {
  payment: UpcomingPayment | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function calculateNextDueDate(currentDueDate: Date, frequency: string): Date {
  const next = new Date(currentDueDate);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

async function updateRecurringPaymentNextDueDate(
  paymentId: string,
  currentDueDate: Date,
  frequency: string
): Promise<void> {
  const recurringCollection =
    database.get<RecurringPayment>("recurring_payments");

  await database.write(async () => {
    const payment = await recurringCollection.find(paymentId);
    await payment.update((record) => {
      record.nextDueDate = calculateNextDueDate(currentDueDate, frequency);
    });
  });
}

function formatDueDate(daysUntilDue: number): string {
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
  return `Due in ${daysUntilDue} days`;
}

// Get icon name based on payment name (simple matching)
function getPaymentIcon(name: string): keyof typeof Ionicons.glyphMap {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("netflix") || nameLower.includes("streaming"))
    return "play-circle";
  if (nameLower.includes("internet") || nameLower.includes("wifi"))
    return "wifi";
  if (
    nameLower.includes("electric") ||
    nameLower.includes("power") ||
    nameLower.includes("utility")
  )
    return "flash";
  if (nameLower.includes("water")) return "water";
  if (nameLower.includes("gas")) return "flame";
  if (nameLower.includes("phone") || nameLower.includes("mobile"))
    return "phone-portrait";
  if (nameLower.includes("rent") || nameLower.includes("house")) return "home";
  if (nameLower.includes("gym") || nameLower.includes("fitness"))
    return "fitness";
  if (
    nameLower.includes("insurance") ||
    nameLower.includes("health") ||
    nameLower.includes("medical")
  )
    return "medical";
  if (nameLower.includes("spotify") || nameLower.includes("music"))
    return "musical-notes";
  if (nameLower.includes("subscription")) return "card";
  return "receipt";
}

// =============================================================================
// Sub-Components
// =============================================================================

function PayNowModal({
  payment,
  visible,
  onClose,
  onSuccess,
}: PayNowModalProps): React.JSX.Element | null {
  const { isDark } = useTheme();
  const { accounts } = useAccounts();
  const [amount, setAmount] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset amount and account when payment changes
  React.useEffect(() => {
    if (payment) {
      setAmount(payment.amount.toString());
      setSelectedAccountId(payment.accountId);
      setShowAccountPicker(false);
    }
  }, [payment]);

  if (!payment) return null;

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const containerClass = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-slate-200";

  const inputClass = isDark
    ? "bg-slate-700 border-slate-600 text-white"
    : "bg-slate-100 border-slate-200 text-slate-800";

  const handleConfirm = async (): Promise<void> => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    setIsSubmitting(true);

    try {
      await createTransaction({
        amount: numericAmount,
        currency: "EGP",
        categoryId: payment.categoryId,
        accountId: selectedAccountId,
        note: `Payment for ${payment.name}`,
        type: "EXPENSE",
        date: new Date(),
      });

      await updateRecurringPaymentNextDueDate(
        payment.id,
        payment.nextDueDate,
        payment.frequency
      );

      setIsSubmitting(false);
      onClose();
      onSuccess(numericAmount);
    } catch (error) {
      setIsSubmitting(false);
      console.error("Error creating transaction:", error);
      Alert.alert("Error", "Failed to create transaction. Please try again.");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/50 items-center justify-center px-5">
          <View
            className={`w-full max-w-[340px] rounded-[20px] border p-6 ${containerClass}`}
          >
            {/* Header */}
            <Text
              className={`text-lg font-bold text-center mb-5 ${isDark ? "text-slate-25" : "text-slate-800"}`}
            >
              Pay {payment.name}
            </Text>

            {/* Amount Input */}
            <View className="mb-4">
              <Text
                className={`text-sm font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Amount (EGP)
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                className={`px-4 py-3 rounded-xl border text-lg font-semibold ${inputClass}`}
                placeholder="0.00"
                placeholderTextColor={
                  isDark ? palette.slate[500] : palette.slate[400]
                }
              />
            </View>

            {/* Account Selector */}
            <View className="mb-4">
              <Text
                className={`text-sm font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Deduct from
              </Text>
              <TouchableOpacity
                onPress={() => setShowAccountPicker(!showAccountPicker)}
                className={`px-4 py-3 rounded-xl border flex-row items-center justify-between ${inputClass}`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="wallet-outline"
                    size={18}
                    color={isDark ? palette.slate[400] : palette.slate[500]}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className={`text-base font-medium ${isDark ? "text-white" : "text-slate-800"}`}
                  >
                    {selectedAccount?.name || "Select account"}
                  </Text>
                </View>
                <Ionicons
                  name={showAccountPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={isDark ? palette.slate[400] : palette.slate[500]}
                />
              </TouchableOpacity>

              {/* Account Picker Dropdown */}
              {showAccountPicker && (
                <View
                  className={`mt-2 rounded-xl border overflow-hidden ${isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-200"}`}
                >
                  <ScrollView style={{ maxHeight: 150 }}>
                    {accounts.map((account) => (
                      <TouchableOpacity
                        key={account.id}
                        onPress={() => {
                          setSelectedAccountId(account.id);
                          setShowAccountPicker(false);
                        }}
                        className={`px-4 py-3 flex-row items-center justify-between border-b ${
                          isDark ? "border-slate-600" : "border-slate-200"
                        } ${account.id === selectedAccountId ? (isDark ? "bg-nileGreen-800/30" : "bg-nileGreen-50") : ""}`}
                      >
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-800"}`}
                          >
                            {account.name}
                          </Text>
                          <Text
                            className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {formatCurrency(account.balance, account.currency)}
                          </Text>
                        </View>
                        {account.id === selectedAccountId && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={palette.nileGreen[500]}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Payment Info */}
            <View className="gap-2 mb-4">
              <View className="flex-row justify-between items-center">
                <Text
                  className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Original amount:
                </Text>
                <Text
                  className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}
                >
                  {formatCurrency(payment.amount, "EGP")}
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text
                  className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Due:
                </Text>
                <Text
                  className={`text-sm font-semibold ${payment.daysUntilDue <= 0 ? "text-red-500" : isDark ? "text-slate-25" : "text-slate-800"}`}
                >
                  {formatDueDate(payment.daysUntilDue)}
                </Text>
              </View>
            </View>

            {/* Info text */}
            <Text
              className={`text-xs text-center mb-5 leading-[18px] ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              This will create a transaction and update your account balance.
            </Text>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                className={`flex-1 py-3 rounded-xl border items-center ${isDark ? "border-slate-700" : "border-slate-300"}`}
              >
                <Text
                  className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={isSubmitting}
                className={`flex-1 py-3 rounded-xl items-center ${isSubmitting ? "bg-nileGreen-600" : "bg-nileGreen-500"}`}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-semibold text-white">
                    Confirm
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

interface FeaturedPaymentCardProps {
  payment: UpcomingPayment;
  onPayNow: () => void;
  isDark: boolean;
}

function FeaturedPaymentCard({
  payment,
  onPayNow,
  isDark,
}: FeaturedPaymentCardProps): React.JSX.Element {
  const dueText = formatDueDate(payment.daysUntilDue);
  const iconName = getPaymentIcon(payment.name);

  const dueClass =
    payment.daysUntilDue <= 3 ? "text-red-400" : "text-nileGreen-400";

  return (
    <View
      className="flex-1 rounded-2xl p-4 items-center border-2 border-nileGreen-600/50"
      style={{
        backgroundColor: `${palette.slate[800]}E6`,
        // Subtle glow effect
        shadowColor: palette.nileGreen[500],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {/* Large Icon in Circle */}
      <View className="w-16 h-16 rounded-full items-center justify-center mb-3 bg-nileGreen-800/50 border border-nileGreen-600">
        <Ionicons name={iconName} size={32} color={palette.nileGreen[400]} />
      </View>

      {/* Name */}
      <Text
        className="text-base font-semibold text-white text-center mb-1"
        numberOfLines={1}
      >
        {payment.name}
      </Text>

      {/* Amount */}
      <Text className="text-xl font-bold text-nileGreen-400 mb-1">
        {formatCurrency(payment.amount, "EGP")}
      </Text>

      {/* Days until due */}
      <Text className={`text-sm font-medium mb-4 ${dueClass}`}>{dueText}</Text>

      {/* Pay Now Button - Matching mockup style */}
      <TouchableOpacity
        onPress={onPayNow}
        className="bg-nileGreen-400 w-full py-3 rounded-xl items-center"
        activeOpacity={0.8}
      >
        <Text className="text-base font-bold text-slate-900">Pay Now</Text>
      </TouchableOpacity>
    </View>
  );
}

interface MiniPaymentItemProps {
  payment: UpcomingPayment;
  isDark: boolean;
}

function MiniPaymentItem({
  payment,
  isDark,
}: MiniPaymentItemProps): React.JSX.Element {
  const dueText = formatDueDate(payment.daysUntilDue);
  const iconName = getPaymentIcon(payment.name);

  const dueClass =
    payment.daysUntilDue <= 3 ? "text-red-400" : "text-slate-400";

  return (
    <View
      className="flex-row items-center rounded-xl p-3"
      style={{
        backgroundColor: `${palette.slate[800]}CC`,
        borderWidth: 1,
        borderColor: palette.slate[700],
      }}
    >
      {/* Icon */}
      <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-slate-700/50">
        <Ionicons name={iconName} size={20} color={palette.nileGreen[400]} />
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text
          className="text-sm font-semibold text-white mb-0.5"
          numberOfLines={1}
        >
          {payment.name}
        </Text>
        <Text className={`text-xs font-medium ${dueClass}`}>{dueText}</Text>
      </View>

      {/* Arrow */}
      <View className="w-6 h-6 rounded-full items-center justify-center bg-nileGreen-500/20">
        <Ionicons
          name="chevron-forward"
          size={14}
          color={palette.nileGreen[400]}
        />
      </View>
    </View>
  );
}

function EmptyState({ isDark }: { isDark: boolean }): React.JSX.Element {
  return (
    <View className="py-6 items-center justify-center">
      <Ionicons
        name="checkmark-circle-outline"
        size={32}
        color={palette.nileGreen[500]}
      />
      <Text
        className={`text-sm font-semibold mt-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}
      >
        No upcoming bills
      </Text>
      <Text
        className={`text-xs text-center mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
      >
        Add recurring payments to track them here
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function UpcomingPayments(): React.JSX.Element {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { payments, totalDueThisMonth, isLoading, refetch } =
    useUpcomingPayments(5);
  const [selectedPayment, setSelectedPayment] =
    useState<UpcomingPayment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handlePayNow = (payment: UpcomingPayment): void => {
    setSelectedPayment(payment);
    setModalVisible(true);
  };

  const handleSuccess = (amount: number): void => {
    refetch();
    showToast({
      type: "success",
      title: "Payment Recorded",
      message: `${selectedPayment?.name} - ${formatCurrency(amount, "EGP")}`,
      duration: 3500,
    });
  };

  const handleSeeAll = (): void => {
    router.push("/recurring-payments");
  };

  // Split payments for display
  const featuredPayment = payments[0];
  const sidePayments = payments.slice(1, 3);

  // Don't render section if no payments
  if (!isLoading && payments.length === 0) {
    return <></>;
  }

  const containerClass = isDark
    ? "bg-slate-800/50 border-slate-700"
    : "bg-slate-100/50 border-slate-200";

  return (
    <View
      className={`mt-3 mb-6 rounded-2xl border p-4 overflow-hidden ${containerClass}`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text
          className={`text-lg font-bold ${isDark ? "text-slate-25" : "text-slate-800"}`}
        >
          Upcoming Bills
        </Text>
        <TouchableOpacity
          onPress={handleSeeAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="flex-row items-center"
        >
          <Text className="text-sm font-semibold text-nileGreen-500">
            See All
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={palette.nileGreen[500]}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="h-[180px] items-center justify-center">
          <ActivityIndicator size="small" color={palette.nileGreen[500]} />
        </View>
      ) : (
        <>
          {/* Featured + Side layout */}
          <View className="flex-row gap-3">
            {/* Featured Card */}
            {featuredPayment && (
              <FeaturedPaymentCard
                payment={featuredPayment}
                onPayNow={() => handlePayNow(featuredPayment)}
                isDark={isDark}
              />
            )}

            {/* Side Mini Items */}
            {sidePayments.length > 0 && (
              <View className="flex-1 gap-2 justify-center">
                {sidePayments.map((payment) => (
                  <MiniPaymentItem
                    key={payment.id}
                    payment={payment}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Total Due This Month */}
          <View
            className={`flex-row items-center justify-between mt-3 pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}
          >
            <Text
              className={`text-[13px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Total due this month:
            </Text>
            <Text className="text-base font-bold text-nileGreen-500">
              {formatCurrency(totalDueThisMonth, "EGP")}
            </Text>
          </View>
        </>
      )}

      {/* Pay Now Modal */}
      <PayNowModal
        payment={selectedPayment}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleSuccess}
      />
    </View>
  );
}
