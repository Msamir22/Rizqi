/**
 * UpcomingPayments Section - Dashboard upcoming bills preview
 *
 * Design: Option D - Featured payment + mini list + Pay Now
 * Shows: Next N payments regardless of month, with clear month labels
 * Features: Pay Now opens modal with editable amount, creates transaction directly
 */

import { database, RecurringPayment } from "@astik/db";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { useAccounts } from "@/hooks/useAccounts";
import { createTransaction } from "@/hooks/useTransactions";
import {
  UpcomingPayment,
  useUpcomingPayments,
} from "@/hooks/useUpcomingPayments";

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
        source: "MANUAL",
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
          <View className="w-full max-w-[340px] rounded-[20px] border p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            {/* Header */}
            <Text className="text-lg font-bold text-center mb-5 text-slate-800 dark:text-slate-25">
              Pay {payment.name}
            </Text>

            {/* Amount Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                Amount (EGP)
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                className="px-4 py-3 rounded-xl border text-lg font-semibold bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white"
                placeholder="0.00"
                placeholderTextColor={palette.slate[400]}
              />
            </View>

            {/* Account Selector */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2 text-slate-500 dark:text-slate-400">
                Deduct from
              </Text>
              <TouchableOpacity
                onPress={() => setShowAccountPicker(!showAccountPicker)}
                className="px-4 py-3 rounded-xl border flex-row items-center justify-between bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="wallet-outline"
                    size={18}
                    className="text-slate-500 mr-2"
                  />
                  <Text className="text-base font-medium text-slate-800 dark:text-white">
                    {selectedAccount?.name || "Select account"}
                  </Text>
                </View>
                <Ionicons
                  name={showAccountPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  className="text-slate-500"
                />
              </TouchableOpacity>

              {/* Account Picker Dropdown */}
              {showAccountPicker && (
                <View className="mt-2 rounded-xl border overflow-hidden bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                  <ScrollView style={{ maxHeight: 150 }}>
                    {accounts.map((account) => (
                      <TouchableOpacity
                        key={account.id}
                        onPress={() => {
                          setSelectedAccountId(account.id);
                          setShowAccountPicker(false);
                        }}
                        className={`px-4 py-3 flex-row items-center justify-between border-b border-slate-200 dark:border-slate-600 ${
                          account.id === selectedAccountId
                            ? "bg-nileGreen-50 dark:bg-nileGreen-800/30"
                            : ""
                        }`}
                      >
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-slate-800 dark:text-white">
                            {account.name}
                          </Text>
                          <Text className="text-xs text-slate-500 dark:text-slate-400">
                            {account.formattedBalance}
                          </Text>
                        </View>
                        {account.id === selectedAccountId && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            className="text-nileGreen-500"
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
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                  Original amount:
                </Text>
                <Text className="text-sm text-slate-600 dark:text-slate-300">
                  {formatCurrency({
                    amount: payment.amount,
                    currency: "EGP",
                  })}
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                  Due:
                </Text>
                <Text
                  className={`text-sm font-semibold ${
                    payment.daysUntilDue <= 0
                      ? "text-red-500"
                      : "text-slate-800 dark:text-slate-25"
                  }`}
                >
                  {formatDueDate(payment.daysUntilDue)}
                </Text>
              </View>
            </View>

            {/* Info text */}
            <Text className="text-xs text-center mb-5 leading-[18px] text-slate-500 dark:text-slate-400">
              This will create a transaction and update your account balance.
            </Text>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl border items-center border-slate-300 dark:border-slate-700"
              >
                <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300">
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
}

function FeaturedPaymentCard({
  payment,
  onPayNow,
}: FeaturedPaymentCardProps): React.JSX.Element {
  const dueText = formatDueDate(payment.daysUntilDue);
  const iconName = getPaymentIcon(payment.name);

  const dueClass =
    payment.daysUntilDue <= 3 ? "text-red-400" : "text-nileGreen-400";

  return (
    <View className="flex-1 rounded-2xl p-4 items-center border-2 border-nileGreen-600/50 bg-slate-800/90 shadow-lg shadow-nileGreen-500/30">
      {/* Large Icon in Circle */}
      <View className="w-16 h-16 rounded-full items-center justify-center mb-3 bg-nileGreen-800/50 border border-nileGreen-600">
        <Ionicons name={iconName} size={32} className="text-nileGreen-400" />
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
        {formatCurrency({
          amount: payment.amount,
          currency: "EGP",
        })}
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
}

function MiniPaymentItem({ payment }: MiniPaymentItemProps): React.JSX.Element {
  const dueText = formatDueDate(payment.daysUntilDue);
  const iconName = getPaymentIcon(payment.name);

  const dueClass =
    payment.daysUntilDue <= 3 ? "text-red-400" : "text-slate-400";

  return (
    <View className="flex-row items-center rounded-xl p-3 bg-slate-800/80 border border-slate-700">
      {/* Icon */}
      <View className="w-10 h-10 rounded-lg items-center justify-center mr-3 bg-slate-700/50">
        <Ionicons name={iconName} size={20} className="text-nileGreen-400" />
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
          className="text-nileGreen-400"
        />
      </View>
    </View>
  );
}

// function EmptyState(): React.JSX.Element {
//   return (
//     <View className="py-6 items-center justify-center">
//       <Ionicons
//         name="checkmark-circle-outline"
//         size={32}
//         className="text-nileGreen-500"
//       />
//       <Text className="text-sm font-semibold mt-2 text-slate-600 dark:text-slate-300">
//         No upcoming bills
//       </Text>
//       <Text className="text-xs text-center mt-1 text-slate-400 dark:text-slate-500">
//         Add recurring payments to track them here
//       </Text>
//     </View>
//   );
// }

// =============================================================================
// Main Component
// =============================================================================

export function UpcomingPayments(): React.JSX.Element {
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
      message: `${selectedPayment?.name} - ${formatCurrency({
        amount,
        currency: "EGP",
      })}`,
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

  return (
    <View className="mt-3 mb-6 rounded-2xl border p-4 overflow-hidden bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-slate-800 dark:text-slate-25">
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
            className="text-nileGreen-500 ml-1"
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
              />
            )}

            {/* Side Mini Items */}
            {sidePayments.length > 0 && (
              <View className="flex-1 gap-2 justify-center">
                {sidePayments.map((payment) => (
                  <MiniPaymentItem key={payment.id} payment={payment} />
                ))}
              </View>
            )}
          </View>

          {/* Total Due This Month */}
          <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <Text className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Total due this month:
            </Text>
            <Text className="text-base font-bold text-nileGreen-500">
              {formatCurrency({
                amount: totalDueThisMonth,
                currency: "EGP",
              })}
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
