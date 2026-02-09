import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency } from "@astik/logic";
import { Account } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { AccountSelector } from "./AccountSelector";

interface TransferFieldsProps {
  accounts: Account[];
  fromAccountId: string;
  toAccountId: string;
  onSelectFrom: (id: string) => void;
  onSelectTo: (id: string) => void;
  amount: string;
  targetAmount: string;
  onChangeTargetAmount: (amount: string) => void;
  exchangeRate?: number; // Optional exchange rate for auto-calculation
}

export function TransferFields({
  accounts,
  fromAccountId,
  toAccountId,
  onSelectFrom,
  onSelectTo,
  amount,
  targetAmount,
  onChangeTargetAmount,
  exchangeRate,
}: TransferFieldsProps) {
  const { isDark } = useTheme();

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const isMultiCurrency =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  // Auto-calculate target amount if exchange rate exists and target amount is empty/zero
  // This logic normally lives in the parent form, but visual feedback is here

  const handleSwap = () => {
    onSelectFrom(toAccountId);
    onSelectTo(fromAccountId);
  };

  return (
    <View className="mb-4">
      {/* From Account */}
      <AccountSelector
        accounts={accounts}
        selectedId={fromAccountId}
        onSelect={onSelectFrom}
        label="FROM ACCOUNT"
        mainColor={palette.blue[500]}
      />

      {/* Swap Button */}
      <View className="items-center -my-3 z-10">
        <TouchableOpacity
          onPress={handleSwap}
          className="bg-white dark:bg-slate-700 p-2 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm"
          activeOpacity={0.8}
        >
          <Ionicons name="swap-vertical" size={20} color={palette.blue[500]} />
        </TouchableOpacity>
      </View>

      {/* To Account */}
      <AccountSelector
        accounts={accounts}
        selectedId={toAccountId}
        onSelect={onSelectTo}
        label="TO ACCOUNT"
        mainColor={palette.blue[500]}
      />

      {/* Multi-currency Target Amount Section */}
      {isMultiCurrency && (
        <View className="mt-4 mx-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Target Amount ({toAccount?.currency})
            </Text>
            {exchangeRate && (
              <Text className="text-[10px] text-slate-400">
                Rate: 1 {fromAccount?.currency} ≈ {exchangeRate.toFixed(2)}{" "}
                {toAccount?.currency}
              </Text>
            )}
          </View>

          <View className="flex-row items-center bg-white dark:bg-slate-800 rounded-xl px-3 border border-blue-200 dark:border-blue-900/30">
            <Text className="text-lg font-bold text-slate-400 mr-2">
              {toAccount?.currency}
            </Text>
            <TextInput
              value={targetAmount}
              onChangeText={onChangeTargetAmount}
              keyboardType="numeric"
              className="flex-1 py-3 text-xl font-bold text-slate-800 dark:text-white"
              placeholder="0.00"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            />
          </View>

          <Text className="text-xs text-slate-400 mt-2">
            Different currencies detected. Please confirm the amount received in{" "}
            {toAccount?.currency}.
          </Text>
        </View>
      )}
    </View>
  );
}
