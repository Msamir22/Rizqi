/**
 * SMS Scan Route
 *
 * Expo Router page that wraps SmsScanProgress + useSmsScan.
 * Auto-starts scanning on mount and navigates to review on completion.
 *
 * Supports two scan modes (set via SmsScanContext):
 *   - "incremental" (default): passes lastSyncTimestamp as minDate
 *   - "full": scans all messages (no minDate)
 *
 * @module sms-scan
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  SUPPORTED_CURRENCIES,
  buildCategoryTree,
  type ParsedSmsTransaction,
} from "@astik/logic";
import { SmsScanProgress } from "@/components/sms-sync/SmsScanProgress";
import { useSmsScan } from "@/hooks/useSmsScan";
import { useSmsScanContext } from "@/context/SmsScanContext";
import { useSmsSync } from "@/hooks/useSmsSync";
import { loadExistingSmsHashes } from "@/services/sms-sync-service";
import { useAccounts } from "@/hooks/useAccounts";
import { useAllCategories } from "@/context/CategoriesContext";
import type { ParseSmsContext } from "@/services/ai-sms-parser-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the top N most frequent category system names from parsed
 * transactions, sorted by frequency (descending).
 */
function getTopCategories(
  transactions: readonly ParsedSmsTransaction[],
  limit: number = 5
): readonly string[] {
  if (transactions.length === 0) return [];
  const frequency = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.categorySystemName) {
      frequency.set(
        tx.categorySystemName,
        (frequency.get(tx.categorySystemName) ?? 0) + 1
      );
    }
  }
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SMS Scan Progress Screen.
 *
 * Automatically starts scanning on mount and displays live progress.
 * On completion with results, "Review Transactions" navigates to the
 * review page. Empty or error states provide back/retry options.
 *
 * When scanMode is "incremental" and lastSyncTimestamp exists, only messages
 * newer than that timestamp are scanned. "full" scans all messages.
 */
export default function SmsScanScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    status,
    progress,
    result,
    transactions,
    accountSuggestions,
    error,
    startScan,
  } = useSmsScan();

  const {
    setTransactions,
    setAccountSuggestions: setCtxAccountSuggestions,
    scanMode,
  } = useSmsScanContext();
  const { lastSyncTimestamp } = useSmsSync();
  const { accounts: existingAccounts, isLoading: isAccountsLoading } =
    useAccounts();
  const { categories: allCategories, isLoading: isCategoriesLoading } =
    useAllCategories();
  const isAiContextReady = !isAccountsLoading && !isCategoriesLoading;

  // Build AI context from existing user data
  const aiContext = useMemo(
    (): ParseSmsContext => ({
      existingAccounts: existingAccounts.map((acc) => ({
        name: acc.name,
        currency: acc.currency,
      })),
      categories: buildCategoryTree(allCategories),
      supportedCurrencies: SUPPORTED_CURRENCIES.map((c) => c.code),
    }),
    [existingAccounts, allCategories]
  );

  // Shared scan initiation logic (used by both auto-start and retry)
  const initiateScan = useCallback(async (): Promise<void> => {
    const minDate =
      scanMode === "incremental" && lastSyncTimestamp
        ? lastSyncTimestamp
        : undefined;

    let existingHashes: ReadonlySet<string> = new Set();
    try {
      existingHashes = await loadExistingSmsHashes();
    } catch (err: unknown) {
      console.warn(
        "[sms-scan] Failed to load existing hashes, continuing with empty set:",
        err instanceof Error ? err.message : String(err)
      );
    }

    startScan({ minDate, existingHashes, aiContext }).catch(console.error);
  }, [startScan, scanMode, lastSyncTimestamp, aiContext]);

  // Track whether scan has been initiated to prevent double-start
  const scanInitiated = useRef(false);

  // Auto-start scan on mount — waits until accounts/categories are loaded
  useEffect(() => {
    if (!isAiContextReady) return;
    if (!scanInitiated.current) {
      scanInitiated.current = true;
      initiateScan().catch(console.error);
    }
  }, [initiateScan, isAiContextReady]);

  const handleReviewPress = (): void => {
    if (transactions.length > 0) {
      setTransactions(transactions);
      setCtxAccountSuggestions(accountSuggestions);
      router.push("/sms-review");
    }
  };

  const handleBackPress = (): void => {
    router.back();
  };

  const handleRetryPress = (): void => {
    initiateScan().catch(console.error);
  };

  // Compute top unique category system names from parsed transactions
  const topCategories = useMemo(
    () => getTopCategories(transactions),
    [transactions]
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={["top", "bottom"]}>
      <SmsScanProgress
        status={status}
        progress={progress}
        transactionsFound={result?.totalFound ?? 0}
        totalScanned={result?.totalScanned ?? 0}
        durationMs={result?.durationMs ?? 0}
        topCategories={topCategories}
        error={error}
        onReviewPress={handleReviewPress}
        onBackPress={handleBackPress}
        onRetryPress={handleRetryPress}
      />
    </SafeAreaView>
  );
}
