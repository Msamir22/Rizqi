/**
 * SMS Review Route
 *
 * Expo Router page with two steps:
 *   1. Account Setup — auto-populated cards from detected SMS senders
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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { useSmsScanContext } from "@/context/SmsScanContext";
import { SmsTransactionReview } from "@/components/sms-sync/SmsTransactionReview";
import { batchCreateSmsTransactions } from "@/services/batch-sms-transactions";
import {
  SenderAccountMapper,
  type AccountCardData,
  type ChannelMapping,
} from "@/components/sms-sync/SenderAccountMapper";
import { useAccounts } from "@/hooks/useAccounts";
import { useSmsSync } from "@/hooks/useSmsSync";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Account, database, type CurrencyType } from "@astik/db";
import { getCurrentUserId } from "@/services/supabase";
import {
  setReviewingActive,
  flushQueuedTransactions,
} from "@/services/sms-live-detection-handler";

// ---------------------------------------------------------------------------
// Flow step enum
// ---------------------------------------------------------------------------

type FlowStep = "setup" | "review";

/**
 * Case-insensitive bidirectional substring check.
 * Returns true if either string contains the other.
 *
 * Examples:
 *   isSubstringMatch("QNB", "QNB EGYPT")  → true ("QNB EGYPT" contains "QNB")
 *   isSubstringMatch("Bank CIB", "CIB")   → true ("Bank CIB" contains "CIB")
 *   isSubstringMatch("Vodafone", "QNB")    → false
 */
function isSubstringMatch(a: string, b: string): boolean {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower.length === 0 || bLower.length === 0) return false;
  return aLower.includes(bLower) || bLower.includes(aLower);
}

/** Generate a short random key for new account cards */
function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface BuildInitialStateResult {
  /** Account cards for senders NOT matched to existing accounts */
  readonly cards: AccountCardData[];
  /** Channel mappings (currently unused in AI path) */
  readonly channels: ChannelMapping[];
  /** Auto-linked senders: senderAddress → existing account ID */
  readonly existingAccountMapping: Record<string, string>;
}

/**
 * Build initial account cards from detected SMS sender addresses.
 *
 * Groups transactions by (senderAddress × currency) and for each group:
 *   1. Checks if any existing account matches the sender name AND currency
 *      → if yes, auto-links silently (no card shown)
 *   2. Otherwise creates an editable card pre-filled with detected currency
 *
 * @param transactions - Parsed SMS transactions from AI
 * @param existingAccounts - User's existing WatermelonDB accounts
 */
function buildInitialState(
  transactions: readonly ParsedSmsTransaction[],
  existingAccounts: readonly Account[]
): BuildInitialStateResult {
  // ── Step 1: Group transactions by senderAddress + currency ──────────
  // Key format: "senderAddress::currency"
  const senderCurrencyGroups = new Map<
    string,
    {
      senderAddress: string;
      displayName: string;
      currency: CurrencyType;
      count: number;
    }
  >();

  for (const tx of transactions) {
    const address = tx.senderAddress ?? tx.senderDisplayName;
    const currency = tx.currency;
    const compositeKey = `${address}::${currency}`;

    if (!senderCurrencyGroups.has(compositeKey)) {
      senderCurrencyGroups.set(compositeKey, {
        senderAddress: address,
        displayName: tx.financialEntity ?? tx.senderDisplayName,
        currency,
        count: 1,
      });
    } else {
      const existing = senderCurrencyGroups.get(compositeKey)!;
      senderCurrencyGroups.set(compositeKey, {
        ...existing,
        count: existing.count + 1,
      });
    }
  }

  // ── Step 2: Match each group against existing accounts ──────────────
  const cards: AccountCardData[] = [];
  const existingAccountMapping: Record<string, string> = {};

  for (const group of senderCurrencyGroups.values()) {
    // Find an existing account that matches by name AND currency
    const matchedAccount = existingAccounts.find(
      (acc) =>
        isSubstringMatch(acc.name, group.displayName) &&
        acc.currency === group.currency
    );

    if (matchedAccount) {
      // Auto-link: sender → existing account (no card shown)
      existingAccountMapping[group.senderAddress] = matchedAccount.id;
    } else {
      // No match: create an editable card
      cards.push({
        key: generateKey(),
        senderConfigId: group.senderAddress,
        name: group.displayName,
        accountType: "BANK",
        currency: group.currency,
        isDefault: false,
      });
    }
  }

  // Mark first card as default if any exist
  if (cards.length > 0) {
    cards[0] = { ...cards[0], isDefault: true };
  }

  return { cards, channels: [], existingAccountMapping };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmsReviewScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    transactions,
    clearTransactions,
    setSenderAccountMap,
    setDefaultAccountId,
    senderAccountMap,
    defaultAccountId,
  } = useSmsScanContext();
  const { accounts: existingAccounts, isLoading: accountsLoading } =
    useAccounts();
  const { markSyncComplete } = useSmsSync();
  const [step, setStep] = useState<FlowStep>("setup");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);

  // T046: Mark review as active to queue incoming live transactions
  useEffect(() => {
    setReviewingActive(true);

    return () => {
      setReviewingActive(false);
      // Flush any transactions queued during review
      flushQueuedTransactions(database).catch(() => {});
    };
  }, []);

  // ── Setup state ──────────────────────────────────────────────────────
  const initialState = useMemo(
    () => buildInitialState(transactions, existingAccounts),
    [transactions, existingAccounts]
  );
  const [accountCards, setAccountCards] = useState<AccountCardData[]>(
    initialState.cards
  );
  const [channelMappings, setChannelMappings] = useState<ChannelMapping[]>(
    initialState.channels
  );
  // Pre-built mapping for senders auto-linked to existing accounts
  const autoLinkedMapping = initialState.existingAccountMapping;

  // Whether user can skip (has existing accounts)
  const canSkip = !accountsLoading && existingAccounts.length > 0;

  // ── Account card handlers ────────────────────────────────────────────

  const handleUpdateAccount = useCallback(
    (key: string, field: keyof AccountCardData, value: string | boolean) => {
      setAccountCards((prev) =>
        prev.map((card) =>
          card.key === key ? { ...card, [field]: value } : card
        )
      );
    },
    []
  );

  const handleRemoveAccount = useCallback((key: string) => {
    setAccountCards((prev) => {
      const filtered = prev.filter((c) => c.key !== key);
      // If we removed the default, make the first remaining card default
      if (filtered.length > 0 && !filtered.some((c) => c.isDefault)) {
        filtered[0] = { ...filtered[0], isDefault: true };
      }
      return filtered;
    });
    // Clear channel mappings that pointed to removed account
    setChannelMappings((prev) =>
      prev.map((ch) =>
        ch.assignedAccountKey === key
          ? { ...ch, assignedAccountKey: undefined }
          : ch
      )
    );
  }, []);

  const handleAddAccount = useCallback(() => {
    setAccountCards((prev) => [
      ...prev,
      {
        key: generateKey(),
        senderConfigId: undefined,
        name: "",
        accountType: "BANK",
        currency: "EGP",
        isDefault: prev.length === 0,
      },
    ]);
  }, []);

  const handleSetDefault = useCallback((key: string) => {
    setAccountCards((prev) =>
      prev.map((card) => ({
        ...card,
        isDefault: card.key === key,
      }))
    );
  }, []);

  const handleUpdateChannel = useCallback(
    (senderConfigId: string, accountKey: string) => {
      setChannelMappings((prev) =>
        prev.map((ch) =>
          ch.senderConfigId === senderConfigId
            ? { ...ch, assignedAccountKey: accountKey }
            : ch
        )
      );
    },
    []
  );

  // ── Submit: create accounts & proceed to review ──────────────────────

  const handleSetupSubmit = useCallback(async () => {
    if (accountCards.length === 0) {
      Alert.alert("Error", "You must create at least one account.");
      return;
    }

    const defaultCard = accountCards.find((c) => c.isDefault);
    if (!defaultCard) {
      Alert.alert("Error", "Please set a default account.");
      return;
    }

    setIsCreatingAccounts(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Session Error", "You must be signed in.");
        return;
      }

      // Create accounts in WatermelonDB and build sender→account mapping
      // Start with auto-linked existing accounts
      const mapping: Record<string, string> = { ...autoLinkedMapping };
      let defaultAccId = "";

      for (const card of accountCards) {
        const account = await database.write(async () => {
          return database.get<Account>("accounts").create((acc) => {
            acc.userId = userId;
            acc.name = card.name.trim();
            acc.type = card.accountType;
            acc.balance = 0;
            acc.currency = card.currency;
            acc.deleted = false;
          });
        });

        // Map sender address → new account ID
        if (card.senderConfigId) {
          mapping[card.senderConfigId] = account.id;
        }

        if (card.isDefault) {
          defaultAccId = account.id;
        }
      }

      // Map channel senders to their assigned account
      for (const ch of channelMappings) {
        if (ch.assignedAccountKey) {
          // Resolve channel's assigned account key to its created account ID
          const assignedCard = accountCards.find(
            (c) => c.key === ch.assignedAccountKey
          );
          const targetAccountId = assignedCard?.senderConfigId
            ? mapping[assignedCard.senderConfigId]
            : undefined;

          if (targetAccountId) {
            mapping[ch.senderConfigId] = targetAccountId;
          }
        }
      }

      // Store mapping in context for the review/save step
      setSenderAccountMap(mapping);
      setDefaultAccountId(defaultAccId);

      // Proceed to review
      setStep("review");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert("Error", `Failed to create accounts: ${message}`);
    } finally {
      setIsCreatingAccounts(false);
    }
  }, [
    accountCards,
    channelMappings,
    autoLinkedMapping,
    setSenderAccountMap,
    setDefaultAccountId,
  ]);

  // ── Skip handler ────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    if (existingAccounts.length === 0) {
      return;
    }
    // Start with auto-linked mapping from existing accounts
    const baseMapping = { ...autoLinkedMapping };
    // Use first existing account as default
    const fallbackId = existingAccounts[0].id;
    setSenderAccountMap(baseMapping);
    setDefaultAccountId(fallbackId);
    setStep("review");
  }, [
    existingAccounts,
    autoLinkedMapping,
    setSenderAccountMap,
    setDefaultAccountId,
  ]);

  // ── Save ────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (selected: readonly ParsedSmsTransaction[]) => {
      if (!defaultAccountId) {
        Alert.alert("Error", "No default account set. Go back to setup.");
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
                  router.replace("/(tabs)" as never);
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
                  router.replace("/(tabs)" as never);
                },
              },
            ]
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert("Error", `Failed to save transactions: ${message}`);
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
            router.replace("/(tabs)" as never);
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
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        <SenderAccountMapper
          accounts={accountCards}
          onUpdateAccount={handleUpdateAccount}
          onRemoveAccount={handleRemoveAccount}
          onAddAccount={handleAddAccount}
          onSetDefault={handleSetDefault}
          channels={channelMappings}
          onUpdateChannel={handleUpdateChannel}
          onSubmit={handleSetupSubmit}
          isSubmitting={isCreatingAccounts}
          canSkip={canSkip}
          onSkip={handleSkip}
        />
      </SafeAreaView>
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
