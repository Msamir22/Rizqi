/**
 * SMS Review Route
 *
 * Expo Router page with two steps:
 *   1. Account Setup — delegated to AccountSetupStep component
 *   2. Transaction Review — list of parsed transactions to confirm/correct
 *
 * Flow: sms-scan.tsx → setTransactions → navigate here → setup → review → save
 *
 * Architecture & Design Rationale:
 * - Pattern: Wizard / Multi-Step Flow (state machine via `step` enum)
 * - Why: Separates account creation from transaction review so each step
 *   is focused (SRP). State machine is simpler than nested routes.
 * - SOLID: Open/Closed — new steps can be added by extending the enum
 *   without touching existing step logic.
 *
 * @module sms-review
 */

import { AccountSetupStep } from "@/components/sms-sync/AccountSetupStep";
import { SmsTransactionReview } from "@/components/sms-sync/SmsTransactionReview";
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { useSmsScanContext } from "@/context/SmsScanContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useSmsSync } from "@/hooks/useSmsSync";
import {
  type AccountSetupResult,
  batchCreateSmsTransactions,
} from "@/services/batch-sms-transactions";
import {
  flushQueuedTransactions,
  setReviewingActive,
} from "@/services/sms-live-detection-handler";
import { database } from "@astik/db";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Flow step enum
// ---------------------------------------------------------------------------

type FlowStep = "setup" | "review";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmsReviewScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    transactions,
    accountSuggestions,
    clearTransactions,
    setSenderAccountMap,
    setDefaultAccountId,
    senderAccountMap,
    defaultAccountId,
  } = useSmsScanContext();
  const { accounts: existingAccounts } = useAccounts();

  const { markSyncComplete } = useSmsSync();
  const { showToast } = useToast();

  const [step, setStep] = useState<FlowStep>("setup");
  const [isSaving, setIsSaving] = useState(false);

  // Mark review as active to queue incoming live transactions
  useEffect(() => {
    setReviewingActive(true);

    return () => {
      setReviewingActive(false);
      flushQueuedTransactions(database).catch(() => {});
    };
  }, []);

  // ── Setup complete handler ──────────────────────────────────────────

  const handleSetupComplete = useCallback(
    (result: AccountSetupResult) => {
      setSenderAccountMap(result.senderAccountMap);
      setDefaultAccountId(result.defaultAccountId);
      setStep("review");
    },
    [setSenderAccountMap, setDefaultAccountId]
  );

  // ── Save ────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (selected: readonly ParsedSmsTransaction[]) => {
      // TODO: remove this check
      if (!defaultAccountId) {
        showToast({
          message: "No default account set. Go back to setup.",
          title: "Error",
          type: "error",
        });
        return;
      }

      setIsSaving(true);
      try {
        const result = await batchCreateSmsTransactions(
          selected,
          senderAccountMap,
          defaultAccountId
        );

        if (result.failedCount > 0) {
          Alert.alert(
            "Partial Save",
            `Saved ${result.savedCount} transaction(s). ${result.failedCount} failed:\n${result.errors.join("\n")}`,
            [
              {
                text: "OK",
                onPress: () => {
                  markSyncComplete().catch(console.error);
                  clearTransactions();
                  router.replace("/(tabs)");
                },
              },
            ]
          );
        } else {
          Alert.alert(
            "Success",
            `Saved ${result.savedCount} transaction${result.savedCount !== 1 ? "s" : ""} from SMS!`,
            [
              {
                text: "View Transactions",
                onPress: () => {
                  markSyncComplete().catch(console.error);
                  clearTransactions();
                  router.replace("/(tabs)");
                },
              },
            ]
          );
        }

        // Notify user if ATM withdrawals were skipped (FR-007)
        if (result.skippedAtmCount > 0) {
          showToast({
            type: "warning",
            title: "ATM Withdrawals Skipped",
            message: result.atmSkipReason,
            duration: 5000,
          });
        }
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
    [
      senderAccountMap,
      defaultAccountId,
      clearTransactions,
      router,
      markSyncComplete,
      showToast,
    ]
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

  // ── Step 1: Account Setup ───────────────────────────────────────────

  if (step === "setup") {
    return (
      <AccountSetupStep
        transactions={transactions}
        accountSuggestions={accountSuggestions}
        existingAccounts={existingAccounts}
        onComplete={handleSetupComplete}
      />
    );
  }

  // ── Step 2: Transaction Review ──────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <TouchableOpacity
          onPress={() => setStep("setup")}
          className="flex-row items-center"
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color={palette.nileGreen[500]}
          />
          <Text className="text-sm text-nileGreen-500 font-medium ml-1.5">
            Back to Setup
          </Text>
        </TouchableOpacity>

        <Text className="text-lg font-bold text-slate-900 dark:text-white">
          Review
        </Text>

        <TouchableOpacity onPress={handleDiscard} hitSlop={8}>
          <Ionicons name="close" size={22} color={palette.slate[400]} />
        </TouchableOpacity>
      </View>

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
