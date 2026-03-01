/**
 * Account Setup Step
 *
 * Self-contained component for the SMS review wizard's account setup phase.
 * Displays AI-suggested account cards, lets users edit/add/remove,
 * then creates accounts in WatermelonDB and reports the result.
 *
 * Architecture & Design Rationale:
 * - Pattern: Container Component + Inversion of Control (onComplete callback)
 * - Why: Encapsulates all setup state, CRUD handlers, and DB writes.
 *   The parent route only needs one callback, not 8+ handler props.
 * - SOLID: SRP — this component handles only account setup.
 *   DIP — communicates result via onComplete, not by directly mutating
 *   parent state or context.
 *
 * @module AccountSetupStep
 */

import { SenderAccountMapper } from "@/components/sms-sync/SenderAccountMapper";
import type {
  AccountCardData,
  ChannelMapping,
} from "@/components/sms-sync/types";
import { palette } from "@/constants/colors";
import { useToast } from "@/components/ui/Toast";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import {
  createAccountsFromSmsSetup,
  type AccountSetupResult,
} from "@/services/batch-sms-transactions";
import type { Account } from "@astik/db";
import {
  buildInitialAccountState,
  generateAccountCardKey,
  type AccountCardState,
  type InitialAccountState,
} from "@/utils/build-initial-account-state";
import type { ParsedSmsTransaction } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccountSetupStepProps {
  readonly transactions: readonly ParsedSmsTransaction[];
  readonly existingAccounts: readonly Account[];
  /** Called when setup completes (accounts created) or user skips */
  readonly onComplete: (result: AccountSetupResult) => void;
  /** Called when user taps the back arrow — returns to SuccessState */
  readonly onBack: () => void;
  /** Called when user taps the cancel icon — discards all and exits flow */
  readonly onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert AccountCardState ↔ AccountCardData for the SenderAccountMapper UI. */
function toCardData(card: AccountCardState): AccountCardData {
  return {
    key: card.key,
    name: card.name,
    accountType: card.accountType,
    currency: card.currency,
    isDefault: card.isDefault,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountSetupStep({
  transactions,
  existingAccounts,
  onComplete,
  onBack,
  onCancel,
}: AccountSetupStepProps): React.JSX.Element {
  const { showToast } = useToast();
  const { preferredCurrency } = usePreferredCurrency();

  // ── Initial state (async – loaded via useEffect) ────────────────────
  const [initialState, setInitialState] = useState<InitialAccountState | null>(
    null
  );
  const [accountCards, setAccountCards] = useState<AccountCardState[]>([]);
  const [channelMappings] = useState<ChannelMapping[]>([]);
  const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);

  // Derived loading state: true until initial account suggestions are ready
  const isLoading = initialState === null;

  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      try {
        const state = await buildInitialAccountState(transactions);
        if (!cancelled) {
          setInitialState(state);
          setAccountCards([...state.cards]);
        }
      } catch {
        // Fallback to empty state so the UI isn't stuck on the skeleton
        if (!cancelled) {
          setInitialState({ cards: [], existingAccountMapping: {} });
          setAccountCards([]);
          showToast({
            type: "warning",
            title: "Could not load suggestions",
            message: "Add accounts manually below.",
          });
        }
      }
    }

    init().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [transactions]);

  const autoLinkedMapping = useMemo(
    () => initialState?.existingAccountMapping ?? {},
    [initialState]
  );

  // Whether user can skip (has existing bank accounts)
  const canSkip = existingAccounts.filter((acc) => acc.isBank).length > 0;

  // ── Card data for the UI ─────────────────────────────────────────────
  const cardData = useMemo(() => accountCards.map(toCardData), [accountCards]);

  // ── Account card CRUD handlers ───────────────────────────────────────

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
      // If there are still cards left, make sure one is default
      if (filtered.length > 0 && !filtered.some((c) => c.isDefault)) {
        filtered[0] = { ...filtered[0], isDefault: true };
      }
      return filtered;
    });
  }, []);

  const handleAddAccount = useCallback(() => {
    setAccountCards((prev) => [
      ...prev,
      {
        key: generateAccountCardKey(),
        name: "",
        accountType: "BANK",
        currency: preferredCurrency,
        isDefault: prev.length === 0,
      },
    ]);
  }, [preferredCurrency]);

  const handleSetDefault = useCallback((key: string) => {
    setAccountCards((prev) =>
      prev.map((card) => ({
        ...card,
        isDefault: card.key === key,
      }))
    );
  }, []);

  const handleUpdateChannel = useCallback(
    (_senderConfigId: string, _accountKey: string) => {
      // Channel mappings are currently
      // Kept for future use
    },
    []
  );

  // ── Submit: create accounts & report result ──────────────────────────

  const handleSubmit = useCallback(async () => {
    if (accountCards.length === 0) {
      return showToast({
        message: "You must create at least one account.",
        title: "Error",
        type: "error",
      });
    }

    if (!accountCards.some((c) => c.isDefault)) {
      return showToast({
        message: "Please select a default account.",
        title: "Error",
        type: "error",
      });
    }

    setIsCreatingAccounts(true);
    try {
      const result = await createAccountsFromSmsSetup(
        accountCards,
        autoLinkedMapping
      );
      onComplete(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast({ message, title: "Error", type: "error" });
    } finally {
      setIsCreatingAccounts(false);
    }
  }, [accountCards, autoLinkedMapping, onComplete, showToast]);

  // ── Skip handler ─────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    const firstBankAccount = existingAccounts.find((acc) => acc.isBank);
    if (!firstBankAccount) return;

    onComplete({
      senderAccountMap: { ...autoLinkedMapping },
      defaultAccountId: firstBankAccount.id,
    });
  }, [existingAccounts, autoLinkedMapping, onComplete]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* ── Header ───────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color={palette.slate[400]} />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-base font-bold text-slate-800 dark:text-white">
          Account Setup
        </Text>
        <TouchableOpacity
          onPress={onCancel}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="close" size={24} color={palette.slate[400]} />
        </TouchableOpacity>
      </View>

      {/* ── Loading Skeleton ─────────────────────────────────── */}
      {isLoading ? (
        <AccountSetupSkeleton />
      ) : (
        <SenderAccountMapper
          accounts={cardData}
          onUpdateAccount={handleUpdateAccount}
          onRemoveAccount={handleRemoveAccount}
          onAddAccount={handleAddAccount}
          onSetDefault={handleSetDefault}
          channels={channelMappings}
          onUpdateChannel={handleUpdateChannel}
          onSubmit={() => {
            handleSubmit().catch(console.error);
          }}
          isSubmitting={isCreatingAccounts}
          canSkip={canSkip}
          onSkip={handleSkip}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

/** Number of skeleton cards to show while account data loads. */
const SKELETON_CARD_COUNT = 3;

/** Pulsing placeholder cards shown during the initial async load. */
function AccountSetupSkeleton(): React.JSX.Element {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 px-4 pt-4">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
        <Animated.View
          key={`skeleton-${String(i)}`}
          style={animatedStyle}
          className="bg-slate-200 dark:bg-slate-800 rounded-2xl h-24 mb-3"
        />
      ))}

      {/* Disabled CTA placeholder */}
      <View className="mt-4">
        <View className="w-full py-4 rounded-2xl bg-slate-300 dark:bg-slate-700 items-center opacity-50">
          <Text className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
            Create accounts & review
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
