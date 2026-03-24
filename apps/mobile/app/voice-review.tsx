/**
 * Voice Review Route
 *
 * Expo Router page that displays voice-parsed transactions for user review.
 * Receives parsed data via route params from useVoiceTransactionFlow.
 *
 * Architecture & Design Rationale:
 * - Pattern: Page Component (thin route wrapper)
 * - Why: Keeps route files lightweight. Business logic lives in services/hooks.
 *   This page only orchestrates rendering and save/discard actions.
 * - SOLID: SRP — orchestrates review UI only. DIP — depends on service
 *   abstractions for persistence.
 *
 * @module voice-review
 */

import { PageHeader } from "@/components/navigation/PageHeader";
import { TransactionReview } from "@/components/transaction-review/TransactionReview";
import { useToast } from "@/components/ui/Toast";
import { palette } from "@/constants/colors";
import { batchCreateSmsTransactions } from "@/services/batch-sms-transactions";
import type { ParsedSmsTransaction } from "@astik/logic/src/types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoiceReviewScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactions: string;
    transcript: string;
    originTabIndex: string;
  }>();
  const { showToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);

  // Parse transactions from route params
  const transactions = useMemo<readonly ParsedSmsTransaction[]>(() => {
    try {
      if (!params.transactions) return [];
      const parsed = JSON.parse(params.transactions) as ParsedSmsTransaction[];
      // Restore Date objects from serialized strings
      return parsed.map((t) => ({
        ...t,
        date: new Date(t.date),
      }));
    } catch {
      console.error("[voice-review] Failed to parse transactions from params");
      return [];
    }
  }, [params.transactions]);

  const transcript = params.transcript ?? "";

  // ── Save ────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (
      selected: readonly ParsedSmsTransaction[],
      transactionAccountMap: ReadonlyMap<number, string>,
      toAccountMap: ReadonlyMap<number, string>
    ): Promise<void> => {
      setIsSaving(true);
      try {
        const result = await batchCreateSmsTransactions(
          selected,
          transactionAccountMap,
          toAccountMap
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
          message: `Saved ${result.savedCount} transaction${result.savedCount !== 1 ? "s" : ""} from voice!`,
        });

        // Navigate back to origin tab (FR-024: post-save navigation)
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
    [router, showToast]
  );

  // ── Discard ─────────────────────────────────────────────────────────

  const handleDiscard = useCallback((): void => {
    Alert.alert(
      "Discard All",
      "Are you sure you want to discard all voice transactions?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            router.replace("/(tabs)" as never);
          },
        },
      ]
    );
  }, [router]);

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
          No transactions to review.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)" as never)}
          className="mt-6 px-6 py-3 rounded-2xl"
          style={{ backgroundColor: palette.slate[800] }}
        >
          <Text className="text-white font-semibold">Back to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Voice Review ────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <PageHeader
        title="Review Voice Transaction"
        showDrawer={false}
        showBackButton={true}
      />

      {/* Transcript preview */}
      {transcript.length > 0 && (
        <View className="mx-4 mb-3 rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
          <View className="flex-row items-center mb-1">
            <Ionicons name="mic-outline" size={14} color={palette.slate[500]} />
            <Text className="ml-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              What you said
            </Text>
          </View>
          <Text className="text-sm text-slate-700 dark:text-slate-300">
            {transcript}
          </Text>
        </View>
      )}

      {/* Transaction review list (reuses SMS review component) */}
      <TransactionReview
        transactions={transactions as ParsedSmsTransaction[]}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isSaving}
      />
    </SafeAreaView>
  );
}
