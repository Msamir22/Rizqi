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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccountSetupStepProps {
  readonly transactions: readonly ParsedSmsTransaction[];
  readonly existingAccounts: readonly Account[];
  /** Called when setup completes (accounts created) or user skips */
  readonly onComplete: (result: AccountSetupResult) => void;
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

  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      const state = await buildInitialAccountState(transactions);
      if (!cancelled) {
        setInitialState(state);
        setAccountCards([...state.cards]);
      }
    }

    init().catch(console.error);

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
    </SafeAreaView>
  );
}
