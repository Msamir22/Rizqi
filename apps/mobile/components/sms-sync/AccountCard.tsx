/**
 * AccountCard
 *
 * A single editable account card for the SMS setup wizard.
 * Displays name input, type/currency dropdowns, and default badge.
 *
 * @module AccountCard
 */

import { Dropdown } from "@/components/ui/Dropdown";
import { ACCOUNT_TYPES, CURRENCIES } from "@/constants/accounts";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { AccountCardData } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

interface AccountCardProps {
  readonly data: AccountCardData;
  readonly onUpdate: (
    field: keyof AccountCardData,
    value: string | boolean
  ) => void;
  readonly onRemove: () => void;
  readonly onSetDefault: () => void;
  readonly canRemove: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DefaultBadgeProps {
  readonly isDefault: boolean;
  readonly onSetDefault: () => void;
}

function DefaultBadge({
  isDefault,
  onSetDefault,
}: DefaultBadgeProps): React.JSX.Element {
  if (isDefault) {
    return (
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
    );
  }

  return (
    <TouchableOpacity
      onPress={onSetDefault}
      activeOpacity={0.7}
      className="flex-row items-center mt-0.5"
    >
      <Ionicons name="star-outline" size={12} color={palette.slate[400]} />
      <Text className="ml-1 text-xs font-medium text-slate-400">
        Set as default
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountCard({
  data,
  onUpdate,
  onRemove,
  onSetDefault,
  canRemove,
}: AccountCardProps): React.JSX.Element {
  const { isDark } = useTheme();
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
      className="mb-4 mx-4 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden"
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
            <DefaultBadge
              isDefault={data.isDefault}
              onSetDefault={onSetDefault}
            />
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
