/**
 * SmsTransactionReview Component
 *
 * Full-screen review UI for parsed SMS transactions. Provides:
 * - Filter pills (Period + Type) reusing existing filter modals
 * - Search bar for counterparty/sender text filtering
 * - Date-grouped FlatList of SmsTransactionItem rows
 * - "Select All / Deselect All" toggle
 * - Summary bar showing counts
 * - "Save Selected" and "Discard All" actions
 * - Category correction via CategorySelectorModal
 *
 * Architecture & Design Rationale:
 * - Pattern: Container Component (owns selection + filter state + callbacks)
 * - Why: Encapsulates review logic while delegating each row to
 *   the presentational SmsTransactionItem component (SRP).
 * - SOLID: Open/Closed — reuses PeriodFilterModal and TypeFilterModal
 *   without modifying them. Client-side filtering avoids DB coupling.
 *
 * @module SmsTransactionReview
 */

import { PeriodFilterModal } from "@/components/modals/PeriodFilterModal";
import { TypeFilterModal } from "@/components/modals/TypeFilterModal";
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useCategories } from "@/hooks/useCategories";
import { useMarketRates } from "@/hooks/useMarketRates";
import { PERIOD_LABELS, getPeriodDateRange } from "@/hooks/usePeriodSummary";
import type {
  GroupingPeriod,
  TransactionTypeFilter,
} from "@/hooks/useTransactionsGrouping";
import type { PendingAccount } from "@/services/pending-account-service";
import {
  type AccountMatch,
  type AccountWithBankDetails,
  fetchAccountsWithDetails,
  matchTransactionsBatched,
} from "@/services/sms-account-matcher";
import { prepareSavePayload } from "@/services/sms-review-save-service";
import { getCurrentUserId } from "@/services/supabase";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  SmsTransactionEditModal,
  type TransactionEdits,
} from "./SmsTransactionEditModal";
import { SmsTransactionItem } from "./SmsTransactionItem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsTransactionReviewProps {
  /** All parsed transactions from the scan */
  readonly transactions: readonly ParsedSmsTransaction[];
  /** Called when user saves selected transactions with their account mappings */
  readonly onSave: (
    selected: readonly ParsedSmsTransaction[],
    transactionAccountMap: ReadonlyMap<number, string>
  ) => Promise<void>;
  /** Called when user discards all */
  readonly onDiscard: () => void;
  /** Whether save is in progress */
  readonly isSaving: boolean;
}

/** List item — either a date header or a transaction row */
type ReviewListItem =
  | { readonly kind: "header"; readonly date: string; readonly key: string }
  | {
      readonly kind: "transaction";
      readonly originalIndex: number;
      readonly tx: ParsedSmsTransaction;
      readonly key: string;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByDate(
  transactions: readonly ParsedSmsTransaction[],
  originalTransactions: readonly ParsedSmsTransaction[]
): readonly ReviewListItem[] {
  const items: ReviewListItem[] = [];
  let lastDate = "";

  // Build a lookup from transaction reference → original index
  const originalIndexMap = new Map<ParsedSmsTransaction, number>();
  originalTransactions.forEach((tx, i) => originalIndexMap.set(tx, i));

  // Transactions are assumed to be roughly sorted by date from the scan
  const sorted = [...transactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  sorted.forEach((tx) => {
    const dateKey = tx.date.toLocaleDateString("en-EG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (dateKey !== lastDate) {
      items.push({ kind: "header", date: dateKey, key: `h-${dateKey}` });
      lastDate = dateKey;
    }

    const originalIndex = originalIndexMap.get(tx) ?? 0;
    items.push({
      kind: "transaction",
      originalIndex,
      tx,
      key: `tx-${originalIndex}`,
    });
  });

  return items;
}

/**
 * Apply period, type, and search filters on in-memory parsed transactions.
 * Returns a new array of filtered transactions.
 */
function applyFilters(
  transactions: readonly ParsedSmsTransaction[],
  period: GroupingPeriod,
  selectedTypes: readonly TransactionTypeFilter[],
  searchQuery: string
): readonly ParsedSmsTransaction[] {
  let filtered = [...transactions];

  // Period filter
  if (period !== "all_time") {
    const { startDate, endDate } = getPeriodDateRange(period);
    filtered = filtered.filter((tx) => {
      const time = tx.date.getTime();
      return time >= startDate && time <= endDate;
    });
  }

  // Type filter — map ParsedSmsTransaction type to TransactionTypeFilter
  const includesAll = selectedTypes.includes("All");
  if (!includesAll && selectedTypes.length > 0) {
    filtered = filtered.filter((tx) => {
      const txType = tx.type === "INCOME" ? "Income" : "Expense";
      return selectedTypes.includes(txType);
    });
  }

  // Search filter
  if (searchQuery.trim()) {
    const lower = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      (tx) =>
        tx.counterparty?.toLowerCase().includes(lower) ||
        tx.senderDisplayName.toLowerCase().includes(lower) ||
        tx.amount.toString().includes(lower)
    );
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmsTransactionReview({
  transactions,
  onSave,
  onDiscard,
  isSaving,
}: SmsTransactionReviewProps): React.JSX.Element {
  const { isDark } = useTheme();

  // ── Filter state ──────────────────────────────────────────────────
  const [period, setPeriod] = useState<GroupingPeriod>("all_time");
  const [selectedTypes, setSelectedTypes] = useState<TransactionTypeFilter[]>([
    "All",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  // ── Selection state ─────────────────────────────────────────────────
  const [selectedIndices, setSelectedIndices] = useState<ReadonlySet<number>>(
    () => new Set(transactions.map((_, i) => i)) // All selected by default
  );

  const selectedIndicesRef = useRef(selectedIndices);
  selectedIndicesRef.current = selectedIndices;

  // ── Unified transaction overrides ─────────────────────────────────
  // Stores all user edits (amount, counterparty, type, category, account)
  // keyed by original transaction index.
  const [transactionOverrides, setTransactionOverrides] = useState<
    ReadonlyMap<number, TransactionEdits>
  >(new Map());

  // ── Account matching state ────────────────────────────────────────
  const [accountMatches, setAccountMatches] = useState<
    ReadonlyMap<number, AccountMatch>
  >(new Map());
  const [userAccounts, setUserAccounts] = useState<
    readonly AccountWithBankDetails[]
  >([]);

  // ── Pending accounts (in-memory, created via "+ New" in edit modal) ──
  const [pendingAccounts, setPendingAccounts] = useState<
    readonly PendingAccount[]
  >([]);

  // ── Missing info flags (set on failed save validation) ──
  const [invalidIndices, setInvalidIndices] = useState<ReadonlySet<number>>(
    new Set()
  );

  const { showToast } = useToast();

  const handleCreatePendingAccount = useCallback((account: PendingAccount) => {
    setPendingAccounts((prev) => [...prev, account]);
  }, []);

  // ── Market rates for currency conversion ────────────────────────
  const { latestRates } = useMarketRates();

  // ── Inline edit modal state ──────────────────────────────────────
  const [editModalIndex, setEditModalIndex] = useState<number | null>(null);

  const { categories: rootCategories } = useCategories();

  const batchSize = 20;

  // Run batched account matching on mount (progressive rendering)
  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const userId = await getCurrentUserId();
        if (!userId || cancelled) return;

        // Fetch accounts first (also used for edit modal dropdown)
        const accounts = await fetchAccountsWithDetails(userId);
        if (!cancelled) {
          setUserAccounts(accounts);
        }

        // Progressive batch matching (~20 txns/batch)
        // Pass pre-fetched accounts to avoid duplicate DB query
        await matchTransactionsBatched(
          transactions,
          userId,
          batchSize,
          (batchResults) => {
            if (cancelled) return;
            setAccountMatches((prev) => {
              const next = new Map(prev);
              for (const [idx, match] of batchResults) {
                next.set(idx, match);
              }
              return next;
            });
          },
          accounts
        );
      } catch (err: unknown) {
        if (cancelled) return;
        console.warn("[SmsTransactionReview] Account matching failed:", err);
        showToast({
          type: "warning",
          title: "Account Matching Failed",
          message:
            "Some transactions may not have an account assigned. You can assign them manually.",
          duration: 4000,
        });
      }
    };
    // Inner catch handles all errors — no-op catch for the promise chain
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [transactions, showToast]);

  // ── Derived data ──────────────────────────────────────────────────
  const effectiveTransactions = useMemo((): readonly ParsedSmsTransaction[] => {
    return transactions.map((tx, i) => {
      const overrides = transactionOverrides.get(i);
      if (!overrides) return tx;
      return {
        ...tx,
        amount: overrides.amount,
        counterparty: overrides.counterparty,
        type: overrides.type,
        categoryId: overrides.categoryId,
      };
    });
  }, [transactions, transactionOverrides]);

  // Apply filters before grouping
  const filteredTransactions = useMemo(
    () =>
      applyFilters(effectiveTransactions, period, selectedTypes, searchQuery),
    [effectiveTransactions, period, selectedTypes, searchQuery]
  );

  const listItems = useMemo(
    () => groupByDate(filteredTransactions, effectiveTransactions),
    [filteredTransactions, effectiveTransactions]
  );

  // Selection counts based on filtered view
  const filteredOriginalIndices = useMemo(() => {
    const indexMap = new Map<ParsedSmsTransaction, number>();
    effectiveTransactions.forEach((tx, i) => indexMap.set(tx, i));
    return filteredTransactions.map((tx) => indexMap.get(tx) ?? 0);
  }, [filteredTransactions, effectiveTransactions]);

  const allSelected =
    filteredTransactions.length > 0 &&
    filteredOriginalIndices.every((i) => selectedIndices.has(i));
  const selectedCount = selectedIndices.size;

  // ── Callbacks ─────────────────────────────────────────────────────

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(transactions.map((_, i) => i)));
    }
  }, [allSelected, transactions]);

  const handleToggleItem = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleOpenEditModal = useCallback((index: number) => {
    setEditModalIndex(index);
  }, []);

  const handleEditModalSave = useCallback(
    (edits: TransactionEdits) => {
      if (editModalIndex === null) return;

      // Merge new edits into existing overrides for this index
      setTransactionOverrides((prev) => {
        const next = new Map(prev);
        const existing = next.get(editModalIndex) ?? {};
        next.set(editModalIndex, { ...existing, ...edits });
        return next;
      });

      setEditModalIndex(null);
    },
    [editModalIndex]
  );

  const handleSave = useCallback(async (): Promise<void> => {
    const result = await prepareSavePayload({
      selectedIndices,
      transactionOverrides,
      accountMatches,
      pendingAccounts,
      effectiveTransactions,
    });

    if (!result.success) {
      if (result.reason === "missing_accounts") {
        setInvalidIndices(result.missingIndices);
        showToast({
          type: "warning",
          title: "Missing Info",
          message: result.message,
          duration: 4000,
        });
      } else {
        showToast({
          type: "error",
          title: "Account Creation Failed",
          message: result.message,
        });
      }
      return;
    }

    // Clear any previous flags
    setInvalidIndices(new Set());

    await onSave(result.selected, result.transactionAccountMap);
  }, [
    effectiveTransactions,
    selectedIndices,
    accountMatches,
    transactionOverrides,
    pendingAccounts,
    onSave,
    showToast,
  ]);

  const handleTypeToggle = useCallback((type: TransactionTypeFilter) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

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

      return (
        <SmsTransactionItem
          transaction={tx}
          index={item.originalIndex}
          isSelected={selectedIndicesRef.current.has(item.originalIndex)}
          accountName={
            transactionOverrides.get(item.originalIndex)?.accountName ??
            accountMatches.get(item.originalIndex)?.accountName ??
            ""
          }
          matchReason={
            accountMatches.get(item.originalIndex)?.matchReason ?? "none"
          }
          senderDisplayName={tx.senderDisplayName}
          onToggleSelect={handleToggleItem}
          onPress={handleOpenEditModal}
          hasMissingInfo={invalidIndices.has(item.originalIndex)}
        />
      );
    },
    [
      accountMatches,
      transactionOverrides,
      invalidIndices,
      handleToggleItem,
      handleOpenEditModal,
    ]
  );

  const keyExtractor = useCallback((item: ReviewListItem) => item.key, []);

  return (
    <View className="flex-1">
      {/* ── Filters & Search ────────────────────────────────────── */}
      <View className="px-5 pt-3 pb-2">
        <View className="flex-row mb-3 flex-wrap gap-2">
          {/* Period Filter Pill */}
          <TouchableOpacity
            testID="sms-filter-period"
            className="flex-row items-center bg-white dark:bg-slate-800 py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-slate-700 gap-2 flex-1"
            onPress={() => setPeriodModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
            />
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
              {PERIOD_LABELS[period]}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={isDark ? palette.slate[500] : palette.slate[400]}
            />
          </TouchableOpacity>

          {/* Type Filter Pill */}
          <TouchableOpacity
            testID="sms-filter-type"
            className="flex-row items-center bg-white dark:bg-slate-800 py-2.5 px-4 rounded-3xl border border-slate-200 dark:border-slate-700 gap-2 flex-1"
            onPress={() => setTypeModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="funnel-outline"
              size={18}
              color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
            />
            <Text
              className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1"
              numberOfLines={1}
            >
              {selectedTypes.length === 2
                ? "All Types"
                : selectedTypes.length === 0
                  ? "No Types"
                  : selectedTypes.join(", ")}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={isDark ? palette.slate[500] : palette.slate[400]}
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="bg-white dark:bg-slate-900 flex-row items-center px-4 h-12 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Ionicons
            name="search-outline"
            size={20}
            color={isDark ? palette.slate[500] : palette.slate[400]}
          />
          <TextInput
            testID="sms-search-input"
            className="flex-1 ml-3 text-slate-800 dark:text-slate-100 text-[16px]"
            placeholder="Search counterparty, sender..."
            placeholderTextColor={palette.slate[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={isDark ? palette.slate[500] : palette.slate[400]}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Summary bar ─────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(100)}
        className="flex-row items-center justify-between px-5 py-3 bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800"
      >
        <Text className="text-sm text-slate-600 dark:text-slate-300">
          <Text className="font-bold text-slate-900 dark:text-white">
            {filteredTransactions.length}
          </Text>{" "}
          found ·{" "}
          <Text className="font-bold text-nileGreen-600 dark:text-nileGreen-400">
            {selectedCount}
          </Text>{" "}
          selected
        </Text>

        <TouchableOpacity
          onPress={handleToggleAll}
          className="flex-row items-center"
          activeOpacity={0.7}
        >
          <Ionicons
            name={allSelected ? "checkbox" : "square-outline"}
            size={18}
            color={allSelected ? palette.nileGreen[400] : palette.slate[400]}
          />
          <Text className="text-xs text-slate-400 ml-1.5">
            {allSelected ? "Deselect All" : "Select All"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Transaction list ────────────────────────────────────── */}
      {filteredTransactions.length === 0 ? (
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
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          extraData={selectedIndices}
          contentContainerClassName="px-4 pb-32"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={7}
        />
      )}

      {/* ── Bottom action bar ───────────────────────────────────── */}
      <Animated.View
        entering={FadeInDown.delay(200)}
        className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800"
      >
        {/* Save Selected */}
        <TouchableOpacity
          onPress={() => {
            handleSave().catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err);
              showToast({
                type: "error",
                title: "Save Error",
                message,
              });
            });
          }}
          disabled={selectedCount === 0 || isSaving}
          activeOpacity={0.85}
          className={`w-full py-4 rounded-2xl items-center mb-3 ${
            selectedCount === 0 || isSaving
              ? "bg-slate-300 dark:bg-slate-700"
              : "bg-nileGreen-600"
          }`}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-bold">
              Save {selectedCount} Transaction{selectedCount !== 1 ? "s" : ""}
            </Text>
          )}
        </TouchableOpacity>

        {/* Discard All */}
        <TouchableOpacity
          onPress={onDiscard}
          disabled={isSaving}
          activeOpacity={0.85}
          className="w-full py-3 rounded-2xl items-center bg-slate-100 dark:bg-slate-800"
        >
          <Text className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
            Discard All
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Filter modals ────────────────────────────────────────── */}
      <PeriodFilterModal
        visible={periodModalVisible}
        selectedPeriod={period}
        onSelect={setPeriod}
        onClose={() => setPeriodModalVisible(false)}
      />

      <TypeFilterModal
        visible={typeModalVisible}
        selectedTypes={selectedTypes}
        onToggle={handleTypeToggle}
        onClose={() => setTypeModalVisible(false)}
      />

      {/* ── Inline edit modal ──────────────────────────────────── */}
      {editModalIndex !== null && effectiveTransactions[editModalIndex] && (
        <SmsTransactionEditModal
          visible={editModalIndex !== null}
          transaction={effectiveTransactions[editModalIndex]}
          currentAccountName={
            transactionOverrides.get(editModalIndex)?.accountName ??
            accountMatches.get(editModalIndex)?.accountName ??
            ""
          }
          currentAccountId={
            transactionOverrides.get(editModalIndex)?.accountId ??
            accountMatches.get(editModalIndex)?.accountId ??
            ""
          }
          accounts={userAccounts}
          rootCategories={rootCategories}
          pendingAccounts={pendingAccounts}
          latestRates={latestRates}
          onSave={handleEditModalSave}
          onCreatePendingAccount={handleCreatePendingAccount}
          onClose={() => setEditModalIndex(null)}
        />
      )}
    </View>
  );
}
