/**
 * BalanceChangedSheet Component
 *
 * A modal that appears when the user saves an account with a changed balance.
 * Displays the balance difference and offers two options:
 * 1. "Just update" — silently updates the balance
 * 2. "Track as Transaction" — creates a balance adjustment transaction
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Modal Component (no business logic)
 * - SOLID: SRP — only displays balance change UI, delegates action to parent
 * - Follows ConfirmationModal pattern for consistency (Modal + BlurView)
 *
 * @module BalanceChangedSheet
 */

import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { palette } from "@/constants/colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Whether to track the balance change as a transaction or silently update. */
type BalanceChangeOption = "silent" | "tracked";

interface BalanceChangedSheetProps {
  /** Whether the sheet is visible */
  readonly visible: boolean;
  /** Fires when the user confirms their choice */
  readonly onConfirm: (option: BalanceChangeOption) => void;
  /** Fires when the user dismisses the sheet */
  readonly onCancel: () => void;
  /** The balance before the edit */
  readonly previousBalance: number;
  /** The new balance after the edit */
  readonly newBalance: number;
  /** The account currency code (e.g., "EGP") for display */
  readonly currencyCode: string;
  /** Whether a submission is in progress */
  readonly isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a number as a compact currency string for display.
 * Uses locale-aware formatting with 2 decimal places.
 */
function formatAmount(amount: number, currency: string): string {
  return `${currency} ${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BalanceChangedSheet({
  visible,
  onConfirm,
  onCancel,
  previousBalance,
  newBalance,
  currencyCode,
  isSubmitting = false,
}: BalanceChangedSheetProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [selectedOption, setSelectedOption] =
    useState<BalanceChangeOption>("silent");

  // Reset selection to default when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedOption("silent");
    }
  }, [visible]);

  const difference = newBalance - previousBalance;
  const isIncrease = difference > 0;
  const changeLabel = isIncrease ? "Increase" : "Decrease";
  const changeColor = isIncrease ? palette.nileGreen[500] : palette.red[500];
  const changeSign = isIncrease ? "+" : "-";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableWithoutFeedback>
            <View className="rounded-t-3xl overflow-hidden border-t border-slate-200/30 dark:border-slate-700/40">
              <BlurView
                intensity={20}
                tint={isDark ? "dark" : "light"}
                className="absolute inset-0"
              />
              <View className="absolute inset-0 bg-white/95 dark:bg-slate-900/95" />

              <View className="px-6 pt-6 pb-10">
                {/* Handle bar */}
                <View className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-6" />

                {/* Header */}
                <View className="items-center mb-6">
                  <View className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-500/20 justify-center items-center mb-3">
                    <Ionicons
                      name="swap-vertical"
                      size={28}
                      color={palette.gold[500]}
                    />
                  </View>
                  <Text className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">
                    Balance Changed
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
                    How would you like to track this change?
                  </Text>
                </View>

                {/* Balance Summary Card */}
                <View className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 mb-6 border border-slate-100 dark:border-slate-700/40">
                  {/* Previous → New */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        Previous
                      </Text>
                      <Text className="text-base font-bold text-slate-600 dark:text-slate-300">
                        {formatAmount(previousBalance, currencyCode)}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={isDark ? palette.slate[500] : palette.slate[400]}
                    />
                    <View className="flex-1 items-end">
                      <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                        New
                      </Text>
                      <Text className="text-base font-bold text-slate-800 dark:text-white">
                        {formatAmount(newBalance, currencyCode)}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View className="h-px bg-slate-200 dark:bg-slate-700 my-2" />

                  {/* Difference */}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {changeLabel}
                    </Text>
                    <Text
                      className="text-lg font-black"
                      style={{ color: changeColor }}
                    >
                      {changeSign}
                      {formatAmount(difference, currencyCode)}
                    </Text>
                  </View>
                </View>

                {/* Options */}
                <View className="mb-6">
                  {/* Option 1: Silent */}
                  <TouchableOpacity
                    onPress={() => setSelectedOption("silent")}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityLabel="Just update the balance silently"
                    accessibilityState={{ checked: selectedOption === "silent" }}
                    className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                      selectedOption === "silent"
                        ? "border-nileGreen-500 bg-nileGreen-50 dark:bg-nileGreen-900/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                        selectedOption === "silent"
                          ? "border-nileGreen-500"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {selectedOption === "silent" && (
                        <View className="w-2.5 h-2.5 rounded-full bg-nileGreen-500" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-slate-800 dark:text-white">
                        Just update the balance
                      </Text>
                      <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Silently adjust without any record
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Tracked */}
                  <TouchableOpacity
                    onPress={() => setSelectedOption("tracked")}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityLabel="Track the balance change as a transaction"
                    accessibilityState={{ checked: selectedOption === "tracked" }}
                    className={`flex-row items-center p-4 rounded-xl border ${
                      selectedOption === "tracked"
                        ? "border-nileGreen-500 bg-nileGreen-50 dark:bg-nileGreen-900/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                        selectedOption === "tracked"
                          ? "border-nileGreen-500"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {selectedOption === "tracked" && (
                        <View className="w-2.5 h-2.5 rounded-full bg-nileGreen-500" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-slate-800 dark:text-white">
                        Track as transaction
                      </Text>
                      <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Create a Balance Adjustment record for your history
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  onPress={() => onConfirm(selectedOption)}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm balance change"
                  className={`py-4 rounded-xl items-center ${
                    isSubmitting
                      ? "bg-nileGreen-400"
                      : "bg-nileGreen-500"
                  }`}
                >
                  <Text className="text-base font-bold text-white">
                    {isSubmitting ? "Saving..." : "Confirm"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
