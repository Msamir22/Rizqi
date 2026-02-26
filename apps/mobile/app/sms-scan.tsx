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

import React, { useEffect, useMemo, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SmsScanProgress } from "@/components/sms-sync/SmsScanProgress";
import { useSmsScan } from "@/hooks/useSmsScan";
import { useSmsScanContext } from "@/context/SmsScanContext";
import { useSmsSync } from "@/hooks/useSmsSync";
import { loadExistingSmsHashes } from "@/services/sms-sync-service";

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
  const { status, progress, result, transactions, error, startScan } =
    useSmsScan();

  const { setTransactions, scanMode } = useSmsScanContext();
  const { lastSyncTimestamp } = useSmsSync();

  // Track whether scan has been initiated to prevent double-start
  const scanInitiated = useRef(false);

  // Auto-start scan on mount
  useEffect(() => {
    if (!scanInitiated.current) {
      scanInitiated.current = true;

      // Determine minDate based on scan mode

      // TODO: Move the below logic to a function because it's used in two places (handleRetryPress).
      const minDate =
        scanMode === "incremental" && lastSyncTimestamp
          ? lastSyncTimestamp
          : undefined;

      // Load existing hashes for dedup, then start scan
      loadExistingSmsHashes()
        .then((existingHashes) => startScan({ minDate, existingHashes }))
        .catch((err: unknown) => {
          console.error(
            "[sms-scan] Scan failed:",
            err instanceof Error ? err.message : String(err)
          );
        });
    }
  }, [startScan, scanMode, lastSyncTimestamp]);

  const handleReviewPress = (): void => {
    if (transactions.length > 0) {
      setTransactions(transactions);
      router.push("/sms-review");
    }
  };

  const handleBackPress = (): void => {
    router.back();
  };

  const handleRetryPress = (): void => {
    scanInitiated.current = false;

    const minDate =
      scanMode === "incremental" && lastSyncTimestamp
        ? lastSyncTimestamp
        : undefined;

    // Load existing hashes for dedup, then retry scan
    loadExistingSmsHashes()
      .then((existingHashes) => startScan({ minDate, existingHashes }))
      .catch((err: unknown) => {
        console.error(
          "[sms-scan] Retry failed:",
          err instanceof Error ? err.message : String(err)
        );
      });
  };

  // Compute top unique category system names from parsed transactions
  // TODO: Move to a helper function
  const topCategories = useMemo((): readonly string[] => {
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
      .slice(0, 5)
      .map(([name]) => name);
  }, [transactions]);

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
