import {
  formatDate,
  getEndOfDay,
  getEndOfMonth,
  getEndOfWeek,
  getStartOfDay,
  getStartOfMonth,
  getStartOfWeek,
  isSameDay,
} from "@/utils/dateHelpers";
import { database, Transaction, Transfer, type CurrencyType } from "@astik/db";
import { convertCurrency } from "@astik/logic";
import { Q } from "@nozbe/watermelondb";
import { useEffect, useMemo, useState } from "react";
import { useMarketRates } from "./useMarketRates";
import { useNetWorth } from "./useNetWorth";
import { PeriodFilter } from "./usePeriodSummary";
import { usePreferredCurrency } from "./usePreferredCurrency";

export type TransactionTypeFilter = "All" | "Income" | "Expense" | "Transfer";

// Reuse existing PeriodFilter type but ensure coverage
export type GroupingPeriod = PeriodFilter;

type TransactionWithType = Transaction & { _type: "transaction" };
type TransferWithType = Transfer & { _type: "transfer" };

// Union type for displaying both transactions and transfers
export type DisplayTransaction =
  | (TransactionWithType & {
      displayNetWorth: number;
      accountName: string;
      categoryName: string;
      categoryIconName: string;
      categoryIconLibrary: string;
    })
  | (TransferWithType & {
      displayNetWorth: number;
      fromAccountName: string;
      toAccountName: string;
    });

export interface GroupedTransaction {
  title: string;
  transactions: DisplayTransaction[];
  groupNetWorth?: number;
  groupTotalIncome: number;
  groupTotalExpense: number;
}

export interface TransactionWithNetWorth extends Transaction {
  displayNetWorth: number; // The calculated hypothetical net worth
}

// -----------------------------------------------------------

function getPeriodDateRange(period: GroupingPeriod): {
  startDate: number;
  endDate: number;
} {
  const now = new Date();

  switch (period) {
    case "today":
      return { startDate: getStartOfDay(now), endDate: getEndOfDay(now) };
    case "this_week": {
      return { startDate: getStartOfWeek(now), endDate: getEndOfWeek(now) };
    }
    case "last_week": {
      const lastWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );
      return {
        startDate: getStartOfWeek(lastWeek),
        endDate: getEndOfWeek(lastWeek),
      };
    }
    case "this_month": {
      return { startDate: getStartOfMonth(now), endDate: getEndOfMonth(now) };
    }
    case "last_month": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        startDate: getStartOfMonth(lastMonth),
        endDate: getEndOfMonth(lastMonth),
      };
    }
    case "six_months": {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1); // Current month + 5 previous
      return {
        startDate: getStartOfMonth(sixMonthsAgo),
        endDate: getEndOfDay(now),
      };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: start.getTime(), endDate: getEndOfDay(now) };
    }
    case "all_time": {
      return { startDate: 0, endDate: Date.now() };
    }
    default:
      return { startDate: 0, endDate: Date.now() };
  }
}

export interface UseTransactionsGroupingResult {
  groupedData: GroupedTransaction[];
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Fetches, filters, enriches, and groups transactions and transfers for display over a selectable period.
 *
 * Fetching respects the selected transaction types and search query, enriches items with account/category
 * display fields, computes per-item and per-group net worth values using current market rates and the preferred currency,
 * and returns grouped data suitable for rendering along with loading state and a refetch trigger.
 *
 * @param period - Time range used to select and group transactions (e.g., today, this_week, this_month).
 * @param selectedTypes - Array of transaction type filters (e.g., "All", "Income", "Expense", "Transfer") that control which items are included.
 * @param searchQuery - Optional text used to filter displayed items by note, counterparty, category, or amount.
 * @returns An object with:
 *  - groupedData: an array of groups where each group has a title, a list of display-ready transactions/transfers, the group's starting net worth, and aggregated income/expense totals,
 *  - isLoading: `true` while data or net-worth information is being loaded,
 *  - refetch: a function that triggers a fresh fetch and reprocessing of displayed items.
 */
export function useTransactionsGrouping(
  period: GroupingPeriod,
  selectedTypes: TransactionTypeFilter[],
  searchQuery: string
): UseTransactionsGroupingResult {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [displayedItems, setDisplayedItems] = useState<DisplayTransaction[]>(
    []
  );
  const { totalNetWorth, isLoading: isNetWorthLoading } = useNetWorth();
  const { latestRates } = useMarketRates();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const { preferredCurrency } = usePreferredCurrency();

  // 1. Fetch Transactions and Transfers
  useEffect(() => {
    setIsDataLoading(true);
    const { startDate, endDate } = getPeriodDateRange(period);

    const transactionsCollection = database.get<Transaction>("transactions");
    const transfersCollection = database.get<Transfer>("transfers");

    // Query 1: Future Transactions > EndDate (for anchor calculation)
    const futureTransactionsQuery = transactionsCollection.query(
      Q.where("deleted", false),
      Q.where("date", Q.gt(endDate)),
      Q.sortBy("date", Q.desc)
    );

    // Query 2: Display Items (Transactions and/or Transfers)
    const fetchDisplayItems: () => Promise<{
      displayTransactions: Transaction[];
      displayTransfers: Transfer[];
    }> = async () => {
      let displayTransactions: Transaction[] = [];
      let displayTransfers: Transfer[] = [];

      const transactionConditions = [
        Q.where("deleted", false),
        Q.where("date", Q.gte(startDate)),
        Q.where("date", Q.lte(endDate)),
        Q.sortBy("date", Q.desc),
      ];

      const transfersQuery = transfersCollection.query(
        Q.where("deleted", false),
        Q.where("date", Q.gte(startDate)),
        Q.where("date", Q.lte(endDate)),
        Q.sortBy("date", Q.desc)
      );

      // Fetch based on selected types
      const includesTransfer = selectedTypes.includes("Transfer");
      const includesIncome = selectedTypes.includes("Income");
      const includesExpense = selectedTypes.includes("Expense");
      const includesAll = selectedTypes.includes("All");

      // Fetch transfers if Transfer is selected or All is selected
      if (includesTransfer || includesAll) {
        displayTransfers = await transfersQuery.fetch();
      }

      // Fetch transactions based on Income/Expense selection
      if (includesAll || (includesIncome && includesExpense)) {
        // Fetch all transaction types
        displayTransactions = await transactionsCollection
          .query(...transactionConditions)
          .fetch();
      } else if (includesIncome) {
        // Fetch only income
        transactionConditions.push(Q.where("type", "INCOME"));
        displayTransactions = await transactionsCollection
          .query(...transactionConditions)
          .fetch();
      } else if (includesExpense) {
        // Fetch only expense
        transactionConditions.push(Q.where("type", "EXPENSE"));
        displayTransactions = await transactionsCollection
          .query(...transactionConditions)
          .fetch();
      }
      // If only Transfer is selected, displayTransactions stays empty
      return { displayTransactions, displayTransfers };
    };

    // Initial fetch to populate data immediately
    const performFetch = async (): Promise<void> => {
      const gapTransactions = await futureTransactionsQuery.fetch();
      const { displayTransactions, displayTransfers } =
        await fetchDisplayItems();

      // Combine and tag with type discriminator
      const combinedRaw: Array<TransactionWithType | TransferWithType> = [
        ...displayTransactions.map(
          (t) =>
            Object.assign(Object.create(t), {
              _type: "transaction" as const,
            }) as TransactionWithType
        ),
        ...displayTransfers.map(
          (t) =>
            Object.assign(Object.create(t), {
              _type: "transfer" as const,
            }) as TransferWithType
        ),
      ].sort((a, b) => b.dateInMs - a.dateInMs);

      // Fetch account names for all items
      const combined: DisplayTransaction[] = await Promise.all(
        combinedRaw.map(async (item) => {
          if (item._type === "transaction") {
            const account = await item.account.fetch().catch(() => {
              return { name: "Unknown" };
            });
            const category = await item.category.fetch().catch(() => null);
            const iconConfig = (
              category as {
                iconConfig?: { iconName: string; iconLibrary: string };
              } | null
            )?.iconConfig;
            return Object.assign(Object.create(item), {
              accountName: account.name,
              categoryName: category?.displayName ?? "Unknown",
              categoryIconName: iconConfig?.iconName ?? "help-circle",
              categoryIconLibrary: iconConfig?.iconLibrary ?? "Ionicons",
            }) as DisplayTransaction;
          } else {
            const fromAccount = await item.fromAccount.fetch().catch(() => {
              return { name: "Unknown" };
            });
            const toAccount = await item.toAccount.fetch().catch(() => {
              return { name: "Unknown" };
            });
            return Object.assign(Object.create(item), {
              fromAccountName: fromAccount.name,
              toAccountName: toAccount.name,
            }) as DisplayTransaction;
          }
        })
      );

      // Apply search filter
      let filtered = combined;
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = combined.filter((item) => {
          if (item._type === "transaction") {
            return (
              (item.note && item.note.toLowerCase().includes(lowerQuery)) ||
              (item.counterparty &&
                item.counterparty.toLowerCase().includes(lowerQuery)) ||
              (item.categoryName &&
                item.categoryName.toLowerCase().includes(lowerQuery)) ||
              item.amount.toString().includes(lowerQuery)
            );
          } else {
            return (
              (item.notes && item.notes.toLowerCase().includes(lowerQuery)) ||
              item.amount.toString().includes(lowerQuery)
            );
          }
        });
      }

      setDisplayedItems(filtered);
      setAllTransactions(gapTransactions);
      setIsDataLoading(false);
    };

    // Perform initial fetch
    performFetch().catch(console.error);

    // Set up observe subscription for subsequent updates.
    // IMPORTANT: observeWithColumns is required (instead of plain observe)
    // because observe() only fires when the set of records matching the query
    // changes (inserts/deletes). observeWithColumns also fires when the
    // specified columns on existing records are updated (e.g. category_id).
    const txSubscription = transactionsCollection
      .query()
      .observeWithColumns([
        "category_id",
        "amount",
        "type",
        "note",
        "counterparty",
        "account_id",
        "date",
      ])
      .subscribe(() => {
        performFetch().catch(console.error);
      });

    const transferSubscription = transfersCollection
      .query()
      .observeWithColumns([
        "amount",
        "from_account_id",
        "to_account_id",
        "notes",
        "date",
      ])
      .subscribe(() => {
        performFetch().catch(console.error);
      });

    return () => {
      txSubscription.unsubscribe();
      transferSubscription.unsubscribe();
    };
  }, [period, selectedTypes, searchQuery]);

  // 2. Calculate Grouped Data
  const groupedData = useMemo(() => {
    if (totalNetWorth === null) {
      return [];
    }

    // Helper: convert a transaction amount to preferred currency using market rates
    const toPreferred = (amount: number, currency: CurrencyType): number => {
      return convertCurrency(amount, currency, preferredCurrency, latestRates);
    };

    // Step A: Calculate Anchor Net Worth
    const getSignedAmount = (item: DisplayTransaction): number => {
      if (item._type === "transaction") {
        const preferredAmount = toPreferred(item.amount, item.currency);
        if (item.isIncome) return preferredAmount;
        if (item.isExpense) return -preferredAmount;
        return 0;
      }
      // Transfers don't affect net worth (money moves between accounts)
      return 0;
    };

    let anchorNW = totalNetWorth;

    allTransactions.forEach((t) => {
      const preferredAmount = toPreferred(t.amount, t.currency);
      if (t.isIncome) anchorNW -= preferredAmount;
      if (t.isExpense) anchorNW += preferredAmount;
    });

    // Step B: Unwind Displayed Items with Net Worth
    let runningNW = anchorNW;
    const processedItems: DisplayTransaction[] = [];

    displayedItems.forEach((item) => {
      // Use Object.create to maintain prototype chain for WatermelonDB models
      const itemWithNW = Object.create(item) as DisplayTransaction;
      Object.assign(itemWithNW, { displayNetWorth: runningNW });

      processedItems.push(itemWithNW);

      runningNW -= getSignedAmount(item);
    });

    // Step C: Grouping
    const groups: GroupedTransaction[] = [];

    const getGroupKey = (date: Date): string => {
      if (searchQuery) return formatDate(date, "MMM d, yyyy");

      if (period === "this_week" || period === "last_week") {
        if (isSameDay(date, new Date())) return "Today";
        if (isSameDay(date, new Date(Date.now() - 86400000)))
          return "Yesterday";
        return formatDate(date, "EEEE, MMM d");
      }

      if (period === "this_month" || period === "last_month") {
        // Group by Week
        const start = new Date(getStartOfWeek(date));
        const end = new Date(getEndOfWeek(date));
        return `${formatDate(start, "MMM d")} - ${formatDate(end, "MMM d")}`;
      }

      if (period === "six_months" || period === "this_year") {
        return formatDate(date, "MMMM yyyy");
      }

      return formatDate(date, "MMM d, yyyy");
    };

    let currentGroup: GroupedTransaction | null = null;

    processedItems.forEach((item) => {
      const groupTitle = getGroupKey(item.date);

      if (!currentGroup || currentGroup.title !== groupTitle) {
        if (currentGroup) groups.push(currentGroup);

        currentGroup = {
          title: groupTitle,
          transactions: [],
          groupNetWorth: item.displayNetWorth,
          groupTotalIncome: 0,
          groupTotalExpense: 0,
        };
      }

      if (currentGroup) {
        currentGroup.transactions.push(item);
        if (item._type === "transaction") {
          const preferredAmount = toPreferred(item.amount, item.currency);
          if (item.isIncome) {
            currentGroup.groupTotalIncome += preferredAmount;
          } else if (item.isExpense) {
            currentGroup.groupTotalExpense += preferredAmount;
          }
        }
      }
    });

    if (currentGroup) groups.push(currentGroup);

    return groups;
  }, [
    allTransactions,
    displayedItems,
    totalNetWorth,
    latestRates,
    preferredCurrency,
    period,
    searchQuery,
  ]);

  const isLoading = isDataLoading || isNetWorthLoading;

  return {
    groupedData,
    isLoading,
    refetch: (): void => {
      // Trigger refetch by forcing state update
      setDisplayedItems([...displayedItems]);
    },
  };
}
