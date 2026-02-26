import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { ACCOUNT_TYPES, CURRENCIES } from "@/constants/accounts";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import type { AccountType, CurrencyType } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ACCOUNTS = 5;

const DEFAULT_ACCOUNT_TOOLTIP =
  "The default account is used for transactions where we can't determine the source account. This ensures no transaction is left unassigned.";

/** Currency items for the currency dropdown */
const CURRENCY_DROPDOWN_ITEMS = CURRENCIES.map((c) => ({
  value: c.value as string,
  label: c.value,
  icon: c.icon,
  iconType: "emoji" as const,
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Form data for a single account card */
export interface AccountCardData {
  /** Internal key (crypto-random or sender config id) */
  readonly key: string;
  /** Source sender config ID (if from auto-detection) */
  readonly senderConfigId: string | undefined;
  /** Account name (editable) */
  name: string;
  /** Account type */
  accountType: AccountType;
  /** Currency */
  currency: CurrencyType;
  /** Whether this is the default account */
  isDefault: boolean;
}

/** A payment channel that must be mapped to an existing account */
export interface ChannelMapping {
  readonly senderConfigId: string;
  readonly displayName: string;
  /** Account key this channel is mapped to */
  assignedAccountKey: string | undefined;
}

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
// Sub-Components
// ---------------------------------------------------------------------------

interface AccountCardProps {
  readonly data: AccountCardData;
  readonly onUpdate: (
    field: keyof AccountCardData,
    value: string | boolean
  ) => void;
  readonly onRemove: () => void;
  readonly onSetDefault: () => void;
  readonly canRemove: boolean;
  readonly isDark: boolean;
}

function AccountCard({
  data,
  onUpdate,
  onRemove,
  onSetDefault,
  canRemove,
  isDark,
}: AccountCardProps): React.JSX.Element {
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  // borderColor requires inline style — Tailwind can't dynamically set border colors
  const borderColor = data.isDefault
    ? palette.gold[600]
    : isDark
      ? palette.slate[700]
      : palette.slate[200];

  return (
    <View
      className="mb-4  mx-4 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden"
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        borderWidth: data.isDefault ? 2 : 1,
        borderColor,
      }}
    >
      {/* ── Header: Icon + Entity name + Badge + Close ─────────── */}
      <View className="flex-row items-start justify-between px-4 pt-4">
        <View className="flex-row items-center flex-1">
          {/* Institution icon */}
          <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-slate-200 dark:bg-slate-700">
            <Ionicons
              name="business-outline"
              size={20}
              color={palette.slate[400]}
            />
          </View>

          {/* Name + default badge */}
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-900 dark:text-white">
              {data.name || "New Account"}
            </Text>

            {data.isDefault ? (
              <View className="flex-row items-center mt-0.5">
                <Ionicons name="star" size={12} color={palette.gold[500]} />
                <Text className="ml-1 text-xs font-bold text-gold-600">
                  Default Account
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Default Account", DEFAULT_ACCOUNT_TOOLTIP)
                  }
                  activeOpacity={0.7}
                  className="ml-1"
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={palette.gold[500]}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={onSetDefault}
                activeOpacity={0.7}
                className="flex-row items-center mt-0.5"
              >
                <Ionicons
                  name="star-outline"
                  size={12}
                  color={palette.slate[400]}
                />
                <Text className="ml-1 text-xs font-medium text-slate-400">
                  Set as default
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Close button */}
        {canRemove && (
          <TouchableOpacity
            onPress={onRemove}
            activeOpacity={0.7}
            className="p-1"
          >
            <Ionicons
              name="close"
              size={22}
              color={isDark ? palette.slate[400] : palette.slate[500]}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Form fields ────────────────────────────────────────── */}
      <View className="px-4 pt-3 pb-4">
        {/* Account Name */}
        <View className="mb-3">
          <Text className="input-label">ACCOUNT NAME</Text>
          <View className="flex-row items-center bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
            <TextInput
              ref={nameInputRef}
              value={data.name}
              onChangeText={(text) => onUpdate("name", text)}
              placeholder="e.g., CIB Checking"
              placeholderTextColor={palette.slate[400]}
              maxLength={50}
              className="flex-1 p-3.5 text-base font-semibold text-slate-900 dark:text-white"
            />
            <TouchableOpacity
              onPress={() => nameInputRef.current?.focus()}
              activeOpacity={0.7}
              className="pr-3.5"
            >
              <Ionicons
                name="pencil"
                size={18}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Type + Currency row */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Dropdown
              label="TYPE"
              items={ACCOUNT_TYPES.map((t) => ({
                value: t.id,
                label: t.label,
              }))}
              value={data.accountType}
              onChange={(val) => onUpdate("accountType", val)}
              isOpen={isTypeOpen}
              onToggle={() => setIsTypeOpen(!isTypeOpen)}
            />
          </View>
          <View className="flex-1">
            <Dropdown
              label="CURRENCY"
              items={CURRENCY_DROPDOWN_ITEMS}
              value={data.currency}
              onChange={(val) => onUpdate("currency", val)}
              isOpen={isCurrencyOpen}
              onToggle={() => setIsCurrencyOpen(!isCurrencyOpen)}
              useModal
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Channel Mapping Row
// ---------------------------------------------------------------------------

interface ChannelRowProps {
  readonly channel: ChannelMapping;
  readonly accountOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly onUpdate: (accountKey: string) => void;
  readonly isDark: boolean;
}

function ChannelRow({
  channel,
  accountOptions,
  onUpdate,
  isDark,
}: ChannelRowProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="mx-4 mb-3 flex-row items-center gap-2">
      <Text className="text-sm font-bold text-slate-600 dark:text-slate-300 w-24">
        {channel.displayName}
      </Text>
      <Ionicons
        name="arrow-forward"
        size={16}
        color={isDark ? palette.slate[400] : palette.slate[500]}
      />
      <View className="flex-1">
        <Dropdown
          label=""
          items={accountOptions as Array<{ value: string; label: string }>}
          value={channel.assignedAccountKey ?? ""}
          onChange={onUpdate}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
          placeholder="Assign to..."
        />
      </View>
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
  const { isDark } = useTheme();

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
        label: a.name || "Unnamed Account",
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
        isDark={isDark}
      />
    ),
    [onUpdateAccount, onRemoveAccount, onSetDefault, canRemove, isDark]
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
            {/* Add Account Button */}
            {canAdd && (
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
            )}

            {/* Payment Channels Section */}
            {channels.length > 0 && (
              <View className="mt-2 mb-6">
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
                    accountOptions={accountDropdownOptions}
                    onUpdate={(accountKey) =>
                      onUpdateChannel(ch.senderConfigId, accountKey)
                    }
                    isDark={isDark}
                  />
                ))}
              </View>
            )}

            {/* CTA Button */}
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
                {accountCount} {accountCount === 1 ? "account" : "accounts"}{" "}
                will be created
              </Text>
            </View>
          </View>
        }
      />
    </View>
  );
}
