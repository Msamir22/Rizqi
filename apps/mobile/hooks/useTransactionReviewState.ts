import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category, MarketRate } from "@astik/db";
import { useToast } from "@/components/ui/Toast";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLookup } from "@/context/CategoriesContext";
import { useMarketRates } from "@/hooks/useMarketRates";
import { getPeriodDateRange } from "@/hooks/usePeriodSummary";
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
import type { ReviewableTransaction } from "@astik/logic";
import type { TransactionEdits } from "@/services/sms-edit-modal-service";

export type ReviewListItem =
  | { readonly kind: "header"; readonly date: string; readonly key: string }
  | {
      readonly kind: "transaction";
      readonly originalIndex: number;
      readonly tx: ReviewableTransaction;
      readonly key: string;
    };

function groupByDate(
  transactions: readonly ReviewableTransaction[],
  originalTransactions: readonly ReviewableTransaction[]
): readonly ReviewListItem[] {
  const items: ReviewListItem[] = [];
  let lastDate = "";

  const originalIndexMap = new Map<ReviewableTransaction, number>();
  originalTransactions.forEach((tx, i) => originalIndexMap.set(tx, i));

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

function applyFilters(
  transactions: readonly ReviewableTransaction[],
  period: GroupingPeriod,
  selectedTypes: readonly TransactionTypeFilter[],
  searchQuery: string
): readonly ReviewableTransaction[] {
  let filtered = [...transactions];

  if (period !== "all_time") {
    const { startDate, endDate } = getPeriodDateRange(period);
    filtered = filtered.filter((tx) => {
      const time = tx.date.getTime();
      return time >= startDate && time <= endDate;
    });
  }

  const includesAll = selectedTypes.includes("All");
  if (!includesAll && selectedTypes.length > 0) {
    filtered = filtered.filter((tx) => {
      const txType = tx.type === "INCOME" ? "Income" : "Expense";
      return selectedTypes.includes(txType);
    });
  }

  if (searchQuery.trim()) {
    const lower = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      (tx) =>
        tx.counterparty?.toLowerCase().includes(lower) ||
        tx.originLabel.toLowerCase().includes(lower) ||
        tx.amount.toString().includes(lower)
    );
  }

  return filtered;
}

export interface UseTransactionReviewStateProps {
  readonly transactions: readonly ReviewableTransaction[];
  readonly onSave: (
    selected: readonly ReviewableTransaction[],
    transactionAccountMap: ReadonlyMap<number, string>,
    toAccountMap: ReadonlyMap<number, string>
  ) => Promise<void>;
}

export interface UseTransactionReviewStateResult {
  readonly period: GroupingPeriod;
  readonly setPeriod: (p: GroupingPeriod) => void;
  readonly selectedTypes: TransactionTypeFilter[];
  readonly handleTypeToggle: (t: TransactionTypeFilter) => void;
  readonly searchQuery: string;
  readonly setSearchQuery: (q: string) => void;
  readonly periodModalVisible: boolean;
  readonly setPeriodModalVisible: (v: boolean) => void;
  readonly typeModalVisible: boolean;
  readonly setTypeModalVisible: (v: boolean) => void;
  readonly selectedIndices: ReadonlySet<number>;
  readonly selectedIndicesRef: React.MutableRefObject<ReadonlySet<number>>;
  readonly allSelected: boolean;
  readonly selectedCount: number;
  readonly handleToggleAll: () => void;
  readonly handleToggleItem: (index: number) => void;
  readonly listItems: readonly ReviewListItem[];
  readonly filteredTransactions: readonly ReviewableTransaction[];
  readonly effectiveTransactions: readonly ReviewableTransaction[];
  readonly invalidIndices: ReadonlySet<number>;
  readonly userAccounts: readonly AccountWithBankDetails[];
  readonly pendingAccounts: readonly PendingAccount[];
  readonly accountMatches: ReadonlyMap<number, AccountMatch>;
  readonly transactionOverrides: ReadonlyMap<number, TransactionEdits>;
  readonly editModalIndex: number | null;
  readonly setEditModalIndex: (i: number | null) => void;
  readonly handleOpenEditModal: (index: number) => void;
  readonly handleEditModalSave: (edits: TransactionEdits) => void;
  readonly handleCreatePendingAccount: (account: PendingAccount) => void;
  readonly handleSave: () => Promise<void>;
  readonly categoryMap: ReadonlyMap<string, Category>;
  readonly expenseCategories: readonly Category[];
  readonly incomeCategories: readonly Category[];
  readonly latestRates: MarketRate | null;
}

export function useTransactionReviewState({
  transactions,
  onSave,
}: UseTransactionReviewStateProps): UseTransactionReviewStateResult {
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
    () => new Set(transactions.map((_, i) => i))
  );

  const selectedIndicesRef = useRef(selectedIndices);
  selectedIndicesRef.current = selectedIndices;

  // ── Unified transaction overrides ─────────────────────────────────
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

  // ── Pending accounts ──────────────────────────────────────────────
  const [pendingAccounts, setPendingAccounts] = useState<
    readonly PendingAccount[]
  >([]);

  // ── Missing info flags ────────────────────────────────────────────
  const [invalidIndices, setInvalidIndices] = useState<ReadonlySet<number>>(
    new Set()
  );

  const { showToast } = useToast();

  const handleCreatePendingAccount = useCallback((account: PendingAccount) => {
    setPendingAccounts((prev) => [...prev, account]);
  }, []);

  const { latestRates } = useMarketRates();
  const [editModalIndex, setEditModalIndex] = useState<number | null>(null);
  const { expenseCategories, incomeCategories } = useCategories();
  const categoryMap = useCategoryLookup();

  const batchSize = 20;

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const userId = await getCurrentUserId();
        if (!userId || cancelled) return;

        const accounts = await fetchAccountsWithDetails(userId);
        if (!cancelled) {
          setUserAccounts(accounts);
        }

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
        console.warn("[TransactionReview] Account matching failed:", err);
        showToast({
          type: "warning",
          title: "Account Matching Failed",
          message:
            "Some transactions may not have an account assigned. You can assign them manually.",
          duration: 4000,
        });
      }
    };
    run().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [transactions, showToast]);

  const effectiveTransactions =
    useMemo((): readonly ReviewableTransaction[] => {
      return transactions.map((tx, i) => {
        const overrides = transactionOverrides.get(i);
        if (!overrides) return tx;
        return {
          ...tx,
          amount: overrides.amount,
          type: overrides.type,
          categoryId: overrides.categoryId,
          categoryDisplayName:
            categoryMap.get(overrides.categoryId)?.displayName ??
            tx.categoryDisplayName,
          ...(overrides.counterparty !== undefined && {
            counterparty: overrides.counterparty,
          }),
          ...(overrides.note !== undefined && {
            note: overrides.note,
          }),
        };
      });
    }, [transactions, transactionOverrides, categoryMap]);

  const filteredTransactions = useMemo(
    () =>
      applyFilters(effectiveTransactions, period, selectedTypes, searchQuery),
    [effectiveTransactions, period, selectedTypes, searchQuery]
  );

  const listItems = useMemo(
    () => groupByDate(filteredTransactions, effectiveTransactions),
    [filteredTransactions, effectiveTransactions]
  );

  const filteredOriginalIndices = useMemo(() => {
    const indexMap = new Map<ReviewableTransaction, number>();
    effectiveTransactions.forEach((tx, i) => indexMap.set(tx, i));
    return filteredTransactions.map((tx) => indexMap.get(tx) ?? 0);
  }, [filteredTransactions, effectiveTransactions]);

  const allSelected =
    filteredTransactions.length > 0 &&
    filteredOriginalIndices.every((i) => selectedIndices.has(i));
  const selectedCount = selectedIndices.size;

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

      setTransactionOverrides((prev) => {
        const next = new Map(prev);
        const existing = next.get(editModalIndex);
        const definedEdits = Object.fromEntries(
          Object.entries(edits).filter(([, v]) => v !== undefined)
        );
        const merged: TransactionEdits = Object.assign(
          {},
          existing,
          definedEdits
        );
        next.set(editModalIndex, merged);
        return next;
      });

      setEditModalIndex(null);
    },
    [editModalIndex]
  );

  const handleSave = useCallback(async (): Promise<void> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      showToast({
        type: "error",
        title: "Save Error",
        message: "User not authenticated.",
      });
      return;
    }

    const result = await prepareSavePayload({
      selectedIndices,
      transactionOverrides,
      accountMatches,
      pendingAccounts,
      effectiveTransactions,
      userId,
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

    setInvalidIndices(new Set());

    await onSave(
      result.selected,
      result.transactionAccountMap,
      result.toAccountMap
    );
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

  return {
    period,
    setPeriod,
    selectedTypes,
    handleTypeToggle,
    searchQuery,
    setSearchQuery,
    periodModalVisible,
    setPeriodModalVisible,
    typeModalVisible,
    setTypeModalVisible,
    selectedIndices,
    selectedIndicesRef,
    allSelected,
    selectedCount,
    handleToggleAll,
    handleToggleItem,
    listItems,
    filteredTransactions,
    effectiveTransactions,
    invalidIndices,
    userAccounts,
    pendingAccounts,
    accountMatches,
    transactionOverrides,
    editModalIndex,
    setEditModalIndex,
    handleOpenEditModal,
    handleEditModalSave,
    handleCreatePendingAccount,
    handleSave,
    categoryMap,
    expenseCategories,
    incomeCategories,
    latestRates,
  };
}
