/**
 * TransactionItem Component
 *
 * A single row in the transaction review list. Displays:
 * - Selection checkbox
 * - Colour-coded amount (green for income, red for expense)
 * - Sender name and counterparty
 * - Detected category with edit icon
 * - Tap-to-expand for original SMS body
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component + React.memo
 * - Why: Memoized to prevent re-renders when sibling items change.
 *   With 150+ items the parent re-renders frequently (modal open/close,
 *   selection toggle) and every un-memoized item re-renders too.
 * - SOLID: SRP — only renders a single transaction row
 *
 * Performance notes:
 * - No layout animations (LinearTransition) — too expensive at 150+ items
 * - Callbacks receive `index` so the parent can use stable useCallback refs
 *   instead of inline arrows that break React.memo
 *
 * @module TransactionItem
 */

import { palette } from "@/constants/colors";
import type { MatchReason } from "@/services/sms-account-matcher";
import { formatCurrency, type ReviewableTransaction } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  type BadgeColor,
  getTransactionBadges,
  type TransactionBadgeData,
} from "./get-transaction-badges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionItemProps {
  /** The parsed transaction data */
  readonly transaction: ReviewableTransaction;
  /** The original index in the flat transactions array */
  readonly index: number;
  /** Whether this item is selected for saving */
  readonly isSelected: boolean;
  /** Matched account name (or null if unmatched) */
  readonly accountName: string | null;
  /** How the match was determined (used for fallback display) */
  readonly matchReason?: MatchReason;
  /** Optional expanded content (SMS body, voice note, etc.) */
  readonly expandedContent?: React.ReactNode;
  /** Toggle selection — receives index so parent can use a stable ref */
  readonly onToggleSelect: (index: number) => void;
  /** Called when user taps the item to edit — receives index */
  readonly onPress: (index: number) => void;
  /** Whether this item has missing required info (no account, etc.) */
  readonly hasMissingInfo?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as "dd MMM" */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-EG", {
    day: "2-digit",
    month: "short",
  });
}

const BADGE_BG_COLORS: Record<BadgeColor, string> = {
  amber: "bg-amber-500/20",
  red: "bg-red-500/20",
  emerald: "bg-emerald-500/20",
  blue: "bg-blue-500/20",
};

const BADGE_TEXT_COLORS: Record<BadgeColor, string> = {
  amber: "text-amber-400",
  red: "text-red-400",
  emerald: "text-emerald-400",
  blue: "text-blue-400",
};

function TransactionBadge({
  data,
}: {
  readonly data: TransactionBadgeData;
}): React.JSX.Element {
  return (
    <View
      className={`${BADGE_BG_COLORS[data.color]} px-1.5 py-0.5 rounded ml-2`}
    >
      <Text
        className={`text-[10px] font-bold ${BADGE_TEXT_COLORS[data.color]}`}
      >
        {data.label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TransactionItemInner({
  transaction,
  index,
  isSelected,
  accountName,
  expandedContent,
  onToggleSelect,
  onPress,
  hasMissingInfo = false,
}: TransactionItemProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpense = transaction.type === "EXPENSE";

  const badges = getTransactionBadges(transaction, hasMissingInfo);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handlePress = useCallback(() => {
    onPress(index);
  }, [onPress, index]);

  const handleToggle = useCallback(() => {
    onToggleSelect(index);
  }, [onToggleSelect, index]);

  return (
    <View className="bg-slate-800/60 rounded-2xl mb-3 overflow-hidden">
      <TouchableOpacity
        onPress={handlePress}
        className="flex-row items-center p-4"
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <TouchableOpacity
          onPress={handleToggle}
          hitSlop={8}
          className="mr-3"
          activeOpacity={0.7}
        >
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
        </TouchableOpacity>

        {/* Content */}
        <View className="flex-1 mr-3">
          {/* Top row: origin label + amount */}
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center flex-shrink">
              <Text
                className="text-sm font-semibold text-white flex-shrink"
                numberOfLines={1}
              >
                {transaction.originLabel}
              </Text>
              {badges.map((badge, idx) => (
                <TransactionBadge key={idx} data={badge} />
              ))}
            </View>
            <Text
              className={`text-base font-bold ${
                isExpense ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {isExpense ? "-" : "+"}
              {formatCurrency({
                amount: transaction.amount,
                currency: transaction.currency,
              })}
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
                {transaction.categoryDisplayName}
              </Text>
            </View>

            {accountName && (
              <View className="bg-blue-900/40 px-2.5 py-1 rounded-lg">
                <Text className="text-xs text-blue-300">{accountName}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleToggleExpand}
              hitSlop={14}
              className="flex-row items-center ml-auto p-1"
              activeOpacity={0.7}
            >
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={palette.slate[500]}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded: source-specific content */}
      {isExpanded && expandedContent && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="px-4 pb-4 pt-0"
        >
          {expandedContent}
        </Animated.View>
      )}
    </View>
  );
}

/** Memoized to avoid re-rendering all 150+ items on every parent state change. */
export const TransactionItem = memo(TransactionItemInner);
