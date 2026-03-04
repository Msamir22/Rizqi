import { palette } from "@/constants/colors";
import { Account } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { AccountSelectorModal } from "../modals/AccountSelectorModal";
import { formatAmountInput } from "@astik/logic";

interface TransferFieldsProps {
  accounts: Account[];
  fromAccountId: string;
  toAccountId: string;
  onSelectFrom: (id: string) => void;
  onSelectTo: (id: string) => void;
  amount: string;
  targetAmount: string;
  onChangeTargetAmount: (amount: string) => void;
  exchangeRate?: number;
  /** Whether the target amount field is the active keypad target */
  isTargetAmountActive?: boolean;
  /** Called when user taps the target amount to switch keypad focus */
  onFocusTargetAmount?: () => void;
}

export function TransferFields({
  accounts,
  fromAccountId,
  toAccountId,
  onSelectFrom,
  onSelectTo,
  targetAmount,
  onChangeTargetAmount: _onChangeTargetAmount,
  exchangeRate,
  isTargetAmountActive,
  onFocusTargetAmount,
}: TransferFieldsProps): React.JSX.Element {
  const [isFromModalOpen, setIsFromModalOpen] = useState(false);
  const [isToModalOpen, setIsToModalOpen] = useState(false);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const isMultiCurrency =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  // Filter destination accounts to exclude the currently selected source account
  const toAccountOptions = useMemo(
    () => accounts.filter((a) => a.id !== fromAccountId),
    [accounts, fromAccountId]
  );

  // Auto-correct: if From account now matches To account, select the first available alternative
  useEffect(() => {
    if (
      fromAccountId &&
      fromAccountId === toAccountId &&
      toAccountOptions.length > 0
    ) {
      onSelectTo(toAccountOptions[0].id);
    }
  }, [fromAccountId, toAccountId, toAccountOptions, onSelectTo]);

  // Auto-calculate target amount if exchange rate exists and target amount is empty/zero
  // This logic normally lives in the parent form, but visual feedback is here

  const handleSwap = (): void => {
    onSelectFrom(toAccountId);
    onSelectTo(fromAccountId);
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2">
        {/* From Account */}
        <View className="flex-1">
          <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 px-1 uppercase tracking-wider">
            FROM
          </Text>
          <TouchableOpacity
            onPress={() => setIsFromModalOpen(true)}
            activeOpacity={0.7}
            className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
          >
            <Text
              numberOfLines={1}
              className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
            >
              {fromAccount?.name || "Select"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={palette.slate[400]}
            />
          </TouchableOpacity>
        </View>

        {/* Swap Button */}
        <View className="mt-6">
          <TouchableOpacity
            onPress={handleSwap}
            className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
            activeOpacity={0.8}
          >
            <Ionicons
              name="swap-horizontal"
              size={18}
              color={palette.blue[500]}
            />
          </TouchableOpacity>
        </View>

        {/* To Account */}
        <View className="flex-1">
          <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 px-1 uppercase tracking-wider">
            TO
          </Text>
          <TouchableOpacity
            onPress={() => setIsToModalOpen(true)}
            activeOpacity={0.7}
            className="flex-row items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
          >
            <Text
              numberOfLines={1}
              className="flex-1 text-sm font-semibold text-slate-900 dark:text-white"
            >
              {toAccount?.name || "Select"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={palette.slate[400]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <AccountSelectorModal
        visible={isFromModalOpen}
        accounts={accounts}
        selectedId={fromAccountId}
        onSelect={onSelectFrom}
        onClose={() => setIsFromModalOpen(false)}
      />

      <AccountSelectorModal
        visible={isToModalOpen}
        accounts={toAccountOptions}
        selectedId={toAccountId}
        onSelect={onSelectTo}
        onClose={() => setIsToModalOpen(false)}
      />

      {/* Multi-currency Target Amount Section */}
      {isMultiCurrency && (
        <View className="mt-4 mx-2 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Target Amount ({toAccount?.currency})
            </Text>
            {exchangeRate && (
              <Text className="text-[10px] text-slate-400 font-bold dark:text-slate-500">
                1 {fromAccount?.currency} ≈ {exchangeRate.toFixed(2)}{" "}
                {toAccount?.currency}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={onFocusTargetAmount}
            activeOpacity={0.7}
            className={`flex-row items-center bg-white dark:bg-slate-800 rounded-2xl px-4 border shadow-sm ${
              isTargetAmountActive
                ? "border-blue-400 dark:border-blue-500"
                : "border-blue-200 dark:border-blue-900/50"
            }`}
          >
            <Text className="text-lg font-bold text-slate-400 mr-2">
              {toAccount?.currency}
            </Text>
            <Text
              className={`flex-1 py-4 text-xl font-extrabold ${
                targetAmount
                  ? "text-slate-800 dark:text-white"
                  : "text-slate-400"
              }`}
            >
              {targetAmount ? formatAmountInput(targetAmount, "0") : "0.00"}
            </Text>
          </TouchableOpacity>

          <Text className="text-xs text-slate-400 mt-2">
            Please confirm the amount received in {toAccount?.currency}.
          </Text>
        </View>
      )}
    </View>
  );
}
