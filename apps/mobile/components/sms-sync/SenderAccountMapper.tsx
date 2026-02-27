/**
 * SenderAccountMapper
 *
 * Main layout component for the SMS account setup wizard.
 * Composes AccountCard, ChannelRow, and footer sections into a
 * scrollable FlatList with header/footer chrome.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composite Component — delegates rendering to extracted
 *   sub-components (AccountCard, ChannelRow) and local footer sections.
 * - SOLID: SRP — this file only handles list layout and composition.
 *   Card rendering, channel mapping, and shared types live elsewhere.
 *
 * @module SenderAccountMapper
 */

import { Button } from "@/components/ui/Button";
import { palette } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { AccountCard } from "./AccountCard";
import { ChannelRow } from "./ChannelRow";
import type { AccountCardData, ChannelMapping } from "./types";

// Re-export types for backward compatibility
export type { AccountCardData, ChannelMapping } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ACCOUNTS = 5;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SenderAccountMapperProps {
  /** Account cards (editable form data) */
  readonly accounts: readonly AccountCardData[];
  /** Update a single account card field */
  readonly onUpdateAccount: (
    key: string,
    field: keyof AccountCardData,
    value: string | boolean
  ) => void;
  /** Remove an account card */
  readonly onRemoveAccount: (key: string) => void;
  /** Add a blank account card */
  readonly onAddAccount: () => void;
  /** Set default account (toggles off previous default) */
  readonly onSetDefault: (key: string) => void;
  /** Channel mappings (Instapay, Fawry, etc.) */
  readonly channels: readonly ChannelMapping[];
  /** Update channel → account mapping */
  readonly onUpdateChannel: (
    senderConfigId: string,
    accountKey: string
  ) => void;
  /** Submit: create accounts & proceed to review */
  readonly onSubmit: () => void;
  /** Whether submit is in progress */
  readonly isSubmitting: boolean;
  /** Whether the user can skip (subsequent scan with existing accounts) */
  readonly canSkip: boolean;
  /** Handler for skip action */
  readonly onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Footer sub-components
// ---------------------------------------------------------------------------

interface AddAccountButtonProps {
  readonly canAdd: boolean;
  readonly onAddAccount: () => void;
}

function AddAccountButton({
  canAdd,
  onAddAccount,
}: AddAccountButtonProps): React.JSX.Element | null {
  if (!canAdd) return null;

  return (
    <TouchableOpacity
      onPress={onAddAccount}
      activeOpacity={0.7}
      className="mx-4 border-2 border-dashed border-nileGreen-500 mb-4 p-4 rounded-2xl flex-row items-center justify-center"
    >
      <Ionicons name="add" size={20} color={palette.nileGreen[500]} />
      <Text className="ml-2 text-sm font-bold text-nileGreen-600 dark:text-nileGreen-400">
        Add account
      </Text>
      <Text className="ml-1 text-xs font-medium text-slate-400 dark:text-slate-500">
        (up to {MAX_ACCOUNTS} accounts)
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------

interface PaymentChannelsSectionProps {
  readonly channels: readonly ChannelMapping[];
  readonly accountOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly onUpdateChannel: (
    senderConfigId: string,
    accountKey: string
  ) => void;
}

function PaymentChannelsSection({
  channels,
  accountOptions,
  onUpdateChannel,
}: PaymentChannelsSectionProps): React.JSX.Element | null {
  if (channels.length === 0) return null;

  return (
    <View className="mt-2 mb-6">
      {/* Divider */}
      <View className="mx-4 mb-3 flex-row items-center">
        <View className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <Text className="mx-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Payment Channels
        </Text>
        <View className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </View>

      {channels.map((ch) => (
        <ChannelRow
          key={ch.senderConfigId}
          channel={ch}
          accountOptions={accountOptions}
          onUpdate={(accountKey) =>
            onUpdateChannel(ch.senderConfigId, accountKey)
          }
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

interface SetupFooterCTAProps {
  readonly accountCount: number;
  readonly isValid: boolean;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
}

function SetupFooterCTA({
  accountCount,
  isValid,
  isSubmitting,
  onSubmit,
}: SetupFooterCTAProps): React.JSX.Element {
  return (
    <View className="mx-4 mt-2 mb-2">
      <Button
        title="Create accounts & review"
        icon="arrow-forward"
        iconPosition="right"
        variant="primary"
        size="lg"
        onPress={onSubmit}
        isLoading={isSubmitting}
        disabled={!isValid || isSubmitting}
        style={{
          backgroundColor: palette.nileGreen[700],
        }}
      />
      <Text className="mt-2 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        {accountCount} {accountCount === 1 ? "account" : "accounts"} will be
        created
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SenderAccountMapper({
  accounts,
  onUpdateAccount,
  onRemoveAccount,
  onAddAccount,
  onSetDefault,
  channels,
  onUpdateChannel,
  onSubmit,
  isSubmitting,
  canSkip,
  onSkip,
}: SenderAccountMapperProps): React.JSX.Element {
  const accountCount = accounts.length;
  const canAdd = accountCount < MAX_ACCOUNTS;
  const canRemove = accountCount > 1;
  const hasDefault = accounts.some((a) => a.isDefault);
  const isValid =
    accountCount >= 1 &&
    hasDefault &&
    accounts.every((a) => a.name.trim().length > 0);

  /** Dropdown options for channel mapping */
  const accountDropdownOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.key,
        label: a.name,
      })),
    [accounts]
  );

  const renderAccountCard = useCallback(
    ({ item }: { item: AccountCardData }) => (
      <AccountCard
        data={item}
        onUpdate={(field, value) => onUpdateAccount(item.key, field, value)}
        onRemove={() => onRemoveAccount(item.key)}
        onSetDefault={() => onSetDefault(item.key)}
        canRemove={canRemove}
      />
    ),
    [onUpdateAccount, onRemoveAccount, onSetDefault, canRemove]
  );

  const keyExtractor = useCallback((item: AccountCardData) => item.key, []);

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-black text-slate-900 dark:text-white">
            Setup your accounts
          </Text>
          <Text className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            We found transactions from these institutions based on your SMS
            history
          </Text>
        </View>
        {canSkip && (
          <TouchableOpacity
            onPress={onSkip}
            activeOpacity={0.7}
            className="ml-3 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <Text className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Skip warning banner */}
      {canSkip && (
        <View className="mx-4 mb-3 p-3 rounded-xl bg-gold-100/50 dark:bg-gold-800/20 border border-gold-400/30 dark:border-gold-600/30 flex-row items-start">
          <Ionicons
            name="warning-outline"
            size={18}
            color={palette.gold[600]}
            style={{ marginTop: 1 }}
          />
          <Text className="ml-2 flex-1 text-xs font-medium text-gold-800 dark:text-gold-400">
            Skipping will auto-link unrecognized transactions to your default
            account
          </Text>
        </View>
      )}

      {/* Account Cards */}
      <FlatList
        data={accounts}
        renderItem={renderAccountCard}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListFooterComponent={
          <View>
            <AddAccountButton canAdd={canAdd} onAddAccount={onAddAccount} />
            <PaymentChannelsSection
              channels={channels}
              accountOptions={accountDropdownOptions}
              onUpdateChannel={onUpdateChannel}
            />
            <SetupFooterCTA
              accountCount={accountCount}
              isValid={isValid}
              isSubmitting={isSubmitting}
              onSubmit={onSubmit}
            />
          </View>
        }
      />
    </View>
  );
}
