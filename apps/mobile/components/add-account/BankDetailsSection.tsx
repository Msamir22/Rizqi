import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { TextField } from "../ui/TextField";

interface BankDetailsSectionProps {
  expanded: boolean;
  onToggleExpand: () => void;
  bankName: string;
  cardLast4: string;
  cardLast4Error?: string;
  onBankNameChange: (value: string) => void;
  onCardLast4Change: (value: string) => void;
}

/**
 * Expandable section for bank details in the Add Account screen.
 * Follows the OptionalSection pattern from add-transaction.
 */
export function BankDetailsSection({
  expanded,
  onToggleExpand,
  bankName,
  cardLast4,
  cardLast4Error,
  onBankNameChange,
  onCardLast4Change,
}: BankDetailsSectionProps) {
  const { isDark } = useTheme();

  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.7}
        className="flex-row items-center justify-center py-4 mt-2"
      >
        <Ionicons
          name="add-circle-outline"
          size={18}
          color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
        />
        <Text className="ml-2 text-sm font-semibold text-nileGreen-600 dark:text-nileGreen-400">
          Add bank details (Optional)
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.7}
        className="flex-row items-center justify-center mb-6"
      >
        <Text className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Hide Details
        </Text>
        <Ionicons
          name="chevron-up"
          size={14}
          color="#94A3B8"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      <View className="mb-6 ml-1">
        <Text
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          BANK DETAILS
        </Text>
        <Text className="text-xs font-semibold text-slate-600 dark:text-slate-500">
          We'll auto-detect transactions from this card
        </Text>
        <View className="h-[1px] bg-slate-200 dark:bg-slate-800 my-2" />
      </View>

      <TextField
        label="Bank Name"
        placeholder="e.g., CIB, NBE, HSBC"
        value={bankName}
        onChangeText={onBankNameChange}
        className="mb-4"
        maxLength={50}
      />

      <View className="mb-6">
        <TextField
          label="Card Last 4 Digits"
          placeholder="1234"
          value={cardLast4}
          onChangeText={onCardLast4Change}
          keyboardType="numeric"
          maxLength={4}
          error={cardLast4Error}
        />
        <Text
          className={`mt-1.5 ml-2 text-[11px] ${
            isDark ? "text-slate-600" : "text-slate-500"
          }`}
        >
          Found on your card: ****1234
        </Text>
      </View>
    </View>
  );
}
