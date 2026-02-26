/**
 * SmsTransactionItem Component
 *
 * A single row in the SMS transaction review list. Displays:
 * - Selection checkbox
 * - Colour-coded amount (green for income, red for expense)
 * - Sender name and counterparty
 * - Detected category with edit icon
 * - Tap-to-expand for original SMS body
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Receives all data + callbacks via props — easy to test/snapshot
 * - SOLID: SRP — only renders a single transaction row
 *
 * @module SmsTransactionItem
 */

import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import type { ParsedSmsTransaction } from "@astik/logic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsTransactionItemProps {
  /** The parsed transaction data */
  readonly transaction: ParsedSmsTransaction;
  /** Whether this item is selected for saving */
  readonly isSelected: boolean;
  /** Matched account name (or empty if unmatched) */
  readonly accountName: string;
  /** Toggle selection */
  readonly onToggleSelect: () => void;
  /** Called when user taps the item to edit it */
  readonly onPress: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as currency string */
function formatAmount(amount: number): string {
  return amount.toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a Date as "dd MMM" */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-EG", {
    day: "2-digit",
    month: "short",
  });
}

/** Clean category system name for display: "food_dining" → "Food Dining" */
function formatCategoryName(systemName: string): string {
  return systemName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmsTransactionItem({
  transaction,
  isSelected,
  accountName,
  onToggleSelect,
  onPress,
}: SmsTransactionItemProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpense = transaction.type === "EXPENSE";

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <Animated.View
      layout={Layout.springify()}
      className="bg-slate-800/60 rounded-2xl mb-3 overflow-hidden"
    >
      <Pressable
        onPress={onPress}
        onLongPress={handleToggleExpand}
        className="flex-row items-center p-4"
      >
        {/* Checkbox */}
        <Pressable onPress={onToggleSelect} hitSlop={8} className="mr-3">
          <View
            className={`w-6 h-6 rounded-lg items-center justify-center border-2 ${
              isSelected
                ? "bg-emerald-500 border-emerald-500"
                : "border-slate-500"
            }`}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>
        </Pressable>

        {/* Content */}
        <View className="flex-1 mr-3">
          {/* Top row: sender (financialEntity) + amount */}
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center flex-shrink">
              <Text
                className="text-sm font-semibold text-white flex-shrink"
                numberOfLines={1}
              >
                {transaction.senderDisplayName}
              </Text>
              {transaction.isAtmWithdrawal && (
                <View className="bg-amber-500/20 px-1.5 py-0.5 rounded ml-2">
                  <Text className="text-[10px] font-bold text-amber-400">
                    ATM
                  </Text>
                </View>
              )}
            </View>
            <Text
              className={`text-base font-bold ${
                isExpense ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {isExpense ? "-" : "+"}
              {formatAmount(transaction.amount)} {transaction.currency}
            </Text>
          </View>

          {/* Middle row: counterparty + date */}
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="text-xs text-slate-400 flex-shrink"
              numberOfLines={1}
            >
              {transaction.counterparty || "Unknown"}
            </Text>
            <Text className="text-xs text-slate-500">
              {formatDate(transaction.date)}
            </Text>
          </View>

          {/* Bottom row: category + account chips */}
          <View className="flex-row items-center flex-wrap gap-1.5">
            <View className="bg-slate-700/60 px-2.5 py-1 rounded-lg">
              <Text className="text-xs text-slate-300">
                {formatCategoryName(transaction.categorySystemName)}
              </Text>
            </View>
            {accountName ? (
              <View className="bg-blue-900/40 px-2.5 py-1 rounded-lg">
                <Text className="text-xs text-blue-300">{accountName}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center ml-auto">
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={palette.slate[500]}
              />
            </View>
          </View>
        </View>
      </Pressable>

      {/* Expanded: original SMS body */}
      {isExpanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="px-4 pb-4 pt-0"
        >
          <View className="bg-slate-900/60 rounded-xl p-3">
            <Text className="text-xs text-slate-500 mb-1 font-medium">
              Original SMS
            </Text>
            <Text className="text-xs text-slate-400 leading-5">
              {transaction.rawSmsBody}
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
