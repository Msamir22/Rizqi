/**
 * TransactionReview Component
 *
 * Full-screen review UI for parsed SMS transactions. Provides:
 * - Filter pills (Period + Type) reusing existing filter modals
 * - Search bar for counterparty/sender text filtering
 * - Date-grouped FlatList of TransactionItem rows
 * - "Select All / Deselect All" toggle
 * - Summary bar showing counts
 * - "Save Selected" and "Discard All" actions
 * - Category correction via CategorySelectorModal
 *
 * Architecture & Design Rationale:
 * - Pattern: Container Component (owns selection + filter state + callbacks)
 * - Why: Encapsulates review logic while delegating each row to
 *   the presentational TransactionItem component (SRP).
 * - SOLID: Open/Closed — reuses PeriodFilterModal and TypeFilterModal
 *   without modifying them. Client-side filtering avoids DB coupling.
 *
 * @module TransactionReview
 */

import { PeriodFilterModal } from "@/components/modals/PeriodFilterModal";
import { TypeFilterModal } from "@/components/modals/TypeFilterModal";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import type { ReviewableTransaction } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { TransactionEditModal } from "./edit-modal/TransactionEditModal";
import { TransactionItem } from "./TransactionItem";
import { TransactionFiltersBar } from "@/components/transactions/TransactionFiltersBar";
import {
  getExpandedContent,
  OriginalContentBlock,
} from "./get-expanded-content";
import { ReviewActionBar } from "./ReviewActionBar";
import {
  type ReviewListItem,
  useTransactionReviewState,
} from "@/hooks/useTransactionReviewState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionReviewProps {
  /** All parsed transactions from the scan */
  readonly transactions: readonly ReviewableTransaction[];
  /** Called when user saves selected transactions with their account mappings */
  readonly onSave: (
    selected: readonly ReviewableTransaction[],
    transactionAccountMap: ReadonlyMap<number, string>,
    toAccountMap: ReadonlyMap<number, string>
  ) => Promise<void>;
  /** Called when user discards all */
  readonly onDiscard: () => void;
  /** Whether save is in progress */
  readonly isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionReview({
  transactions,
  onSave,
  onDiscard,
  isSaving,
}: TransactionReviewProps): React.JSX.Element {
  const { isDark } = useTheme();

  const state = useTransactionReviewState({ transactions, onSave });

  // ── Render ────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ReviewListItem }) => {
      if (item.kind === "header") {
        return (
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 pt-4 pb-2">
            {item.date}
          </Text>
        );
      }

      const tx = item.tx;
      if (!tx) return null;

      const accountName =
        state.transactionOverrides.get(item.originalIndex)?.accountName ??
        state.accountMatches.get(item.originalIndex)?.accountName ??
        null;

      const content = getExpandedContent(tx);

      return (
        <TransactionItem
          transaction={tx}
          index={item.originalIndex}
          isSelected={state.selectedIndicesRef.current.has(item.originalIndex)}
          accountName={accountName}
          expandedContent={
            content ? (
              <OriginalContentBlock title={content.title} body={content.body} />
            ) : undefined
          }
          onToggleSelect={state.handleToggleItem}
          onPress={state.handleOpenEditModal}
          hasMissingInfo={state.invalidIndices.has(item.originalIndex)}
        />
      );
    },
    [
      state.accountMatches,
      state.transactionOverrides,
      state.invalidIndices,
      state.handleToggleItem,
      state.handleOpenEditModal,
      state.selectedIndicesRef,
    ]
  );

  const keyExtractor = useCallback((item: ReviewListItem) => item.key, []);

  return (
    <View className="flex-1">
      {/* ── Filters & Search ────────────────────────────────────── */}
      <TransactionFiltersBar
        period={state.period}
        onPeriodPress={() => state.setPeriodModalVisible(true)}
        selectedTypes={state.selectedTypes}
        allTypesCount={2}
        onTypePress={() => state.setTypeModalVisible(true)}
        searchQuery={state.searchQuery}
        onSearchChange={state.setSearchQuery}
        searchPlaceholder="Search counterparty, sender..."
        containerClassName="px-5 pb-2"
      />

      {/* ── Summary bar ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(100)}
        className="flex-row items-center justify-between px-5 py-3 bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800"
      >
        <Text className="text-sm text-slate-600 dark:text-slate-300">
          <Text className="font-bold text-slate-900 dark:text-white">
            {state.filteredTransactions.length}
          </Text>{" "}
          found ·{" "}
          <Text className="font-bold text-nileGreen-600 dark:text-nileGreen-400">
            {state.selectedCount}
          </Text>{" "}
          selected
        </Text>

        <TouchableOpacity
          onPress={state.handleToggleAll}
          className="flex-row items-center"
          activeOpacity={0.7}
        >
          <Ionicons
            name={state.allSelected ? "checkbox" : "square-outline"}
            size={18}
            color={
              state.allSelected ? palette.nileGreen[400] : palette.slate[400]
            }
          />
          <Text className="text-xs text-slate-400 ml-1.5">
            {state.allSelected ? "Deselect All" : "Select All"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Transaction list ────────────────────────────────────── */}
      {state.filteredTransactions.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name="search"
            size={40}
            color={isDark ? palette.slate[600] : palette.slate[400]}
          />
          <Text className="text-slate-500 dark:text-slate-400 mt-3 text-center text-sm">
            No transactions match your filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={state.listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          extraData={state.selectedIndices}
          contentContainerClassName="px-4 pb-32"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={7}
        />
      )}

      {/* ── Bottom action bar ───────────────────────────────────── */}
      <ReviewActionBar
        selectedCount={state.selectedCount}
        isSaving={isSaving}
        onSave={state.handleSave}
        onDiscard={onDiscard}
      />

      {/* ── Filter modals ────────────────────────────────────────── */}
      <PeriodFilterModal
        visible={state.periodModalVisible}
        selectedPeriod={state.period}
        onSelect={state.setPeriod}
        onClose={() => state.setPeriodModalVisible(false)}
      />

      <TypeFilterModal
        visible={state.typeModalVisible}
        selectedTypes={state.selectedTypes}
        onToggle={state.handleTypeToggle}
        onClose={() => state.setTypeModalVisible(false)}
      />

      {/* ── Inline edit modal ──────────────────────────────────── */}
      {state.editModalIndex !== null &&
        state.effectiveTransactions[state.editModalIndex] && (
          <TransactionEditModal
            visible={state.editModalIndex !== null}
            transaction={state.effectiveTransactions[state.editModalIndex]}
            currentAccountName={
              state.transactionOverrides.get(state.editModalIndex)
                ?.accountName ??
              state.accountMatches.get(state.editModalIndex)?.accountName ??
              null
            }
            currentAccountId={
              state.transactionOverrides.get(state.editModalIndex)?.accountId ??
              state.accountMatches.get(state.editModalIndex)?.accountId ??
              null
            }
            accounts={state.userAccounts}
            categoryMap={state.categoryMap}
            pendingAccounts={state.pendingAccounts}
            latestRates={state.latestRates}
            expenseCategories={state.expenseCategories}
            incomeCategories={state.incomeCategories}
            onSave={state.handleEditModalSave}
            onCreatePendingAccount={state.handleCreatePendingAccount}
            onClose={() => state.setEditModalIndex(null)}
          />
        )}
    </View>
  );
}
