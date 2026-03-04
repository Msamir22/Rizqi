/**
 * SMS Review Route
 *
 * Expo Router page that shows the transaction review list directly.
 * Account matching is done per-transaction via `matchTransactionsBatched`
 * on the review component (no separate account setup step).
 *
 * Flow: sms-scan.tsx → setTransactions → navigate here → review → save
 *
 * Architecture & Design Rationale:
 * - Pattern: Single-Step Flow (direct review)
 * - Why: Account setup was removed (US1) — matching is now automatic
 *   per-transaction, making a separate setup step unnecessary.
 * - SOLID: SRP — this route only orchestrates navigation and save.
 *   Business logic (matching, persistence) lives in services.
 *
 * @module sms-review
 */

import { SmsTransactionReview } from "@/components/sms-sync/SmsTransactionReview";
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { useSmsScanContext } from "@/context/SmsScanContext";
import { useSmsSync } from "@/hooks/useSmsSync";
import { PageHeader } from "@/components/navigation/PageHeader";
import { batchCreateSmsTransactions } from "@/services/batch-sms-transactions";
import {
  flushQueuedTransactions,
  setReviewingActive,
} from "@/services/sms-live-detection-handler";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmsReviewScreen(): React.JSX.Element {
  const router = useRouter();
  const { transactions, clearTransactions } = useSmsScanContext();
  const { markSyncComplete } = useSmsSync();
  const { showToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);

  // Mark review as active to queue incoming live transactions
  useEffect(() => {
    setReviewingActive(true);

    return () => {
      setReviewingActive(false);
      flushQueuedTransactions().catch((err) => {
        // Non-critical: queued transactions will be processed on next app launch
        console.warn("[sms-review] Failed to flush queued transactions:", err);
      });
    };
  }, []);

  // ── Save ────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (
      selected: readonly ParsedSmsTransaction[],
      transactionAccountMap: ReadonlyMap<number, string>
    ) => {
      setIsSaving(true);
      try {
        const result = await batchCreateSmsTransactions(
          selected,
          transactionAccountMap
        );

        if (result.failedCount > 0) {
          showToast({
            type: "error",
            title: "Save Error",
            message: `${result.savedCount} saved, ${result.failedCount} failed: ${result.errors.join(", ")}`,
          });
          return;
        }

        showToast({
          type: "success",
          title: "Saved!",
          message: `Saved ${result.savedCount} transaction${result.savedCount !== 1 ? "s" : ""} from SMS!`,
        });

        markSyncComplete().catch(console.error);
        clearTransactions();
        router.replace("/(tabs)/transactions");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showToast({
          message: `Failed to save transactions: ${message}`,
          title: "Error",
          type: "error",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [clearTransactions, router, markSyncComplete, showToast]
  );

  // ── Discard ─────────────────────────────────────────────────────────

  const handleDiscard = useCallback(() => {
    Alert.alert(
      "Discard All",
      "Are you sure you want to discard all scanned transactions?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            clearTransactions();
            router.replace("/(tabs)");
          },
        },
      ]
    );
  }, [clearTransactions, router]);

  // ── No transactions guard ───────────────────────────────────────────

  if (transactions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark items-center justify-center px-6">
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={palette.slate[400]}
        />
        <Text className="text-lg text-slate-400 mt-4 text-center">
          No transactions to review. Run a scan first.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)" as never)}
          className="mt-6 px-6 py-3 bg-slate-800 rounded-2xl"
        >
          <Text className="text-white font-semibold">Back to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Transaction Review (direct — no setup step) ─────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <PageHeader
        title="Review Transactions"
        showDrawer={false}
        showBackButton={true}
      />

      {/* Transaction review list */}
      <SmsTransactionReview
        transactions={transactions}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isSaving}
      />
    </SafeAreaView>
  );
}
