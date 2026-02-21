/**
 * UpcomingPayments Section — Dashboard upcoming bills preview.
 *
 * Design: Featured payment card + side mini-items list + Pay Now modal.
 * Shows the next N upcoming expense payments sorted by due date.
 * The section does not render when there are no upcoming payments.
 */

import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { useRecurringPayments } from "@/hooks/useRecurringPayments";
import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import type { RecurringPayment } from "@astik/db";
import {
  FeaturedPaymentCard,
  MiniPaymentItem,
  PayNowModal,
} from "./upcoming-payments";

// Constants

const PAYMENT_LIMIT = 5;
const SIDE_PAYMENTS_COUNT = 3;
const TOAST_DURATION_MS = 3500;

/**
 * Render the "Upcoming Bills" section with a featured payment, side mini items, a total due row, and a Pay Now modal.
 *
 * Displays a loading indicator while payments are loading and renders nothing when there are no upcoming payments. When a payment is completed via the modal, a success toast is shown containing the payment name and formatted amount using the user's preferred currency.
 *
 * @returns The JSX element for the Upcoming Bills UI, or an empty fragment when there are no upcoming payments.
 */

export function UpcomingPayments(): React.JSX.Element {
  const { showToast } = useToast();
  const { preferredCurrency } = usePreferredCurrency();
  const {
    filteredPayments: payments,
    totalDueThisMonth,
    isLoading,
  } = useRecurringPayments({
    limit: PAYMENT_LIMIT,
    status: "ACTIVE",
    type: "EXPENSE",
  });
  const [selectedPayment, setSelectedPayment] =
    useState<RecurringPayment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handlePayNow = (payment: RecurringPayment): void => {
    setSelectedPayment(payment);
    setModalVisible(true);
  };

  const handleSuccess = (amount: number): void => {
    showToast({
      type: "success",
      title: "Payment Recorded",
      message: `${selectedPayment?.name} - ${formatCurrency({
        amount,
        currency: preferredCurrency,
      })}`,
      duration: TOAST_DURATION_MS,
    });
  };

  const handleSeeAll = (): void => {
    router.push("/recurring-payments");
  };

  // Split payments for display
  const featuredPayment = payments[0];
  const sidePayments = payments.slice(1, SIDE_PAYMENTS_COUNT);

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
            color={palette.nileGreen[500]}
            className="ml-1"
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
                currency: preferredCurrency,
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