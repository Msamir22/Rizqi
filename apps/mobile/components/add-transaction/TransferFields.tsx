import { palette } from "@/constants/colors";
import { Account } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
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
  targetAmount,
  onChangeTargetAmount,
  exchangeRate,
}: TransferFieldsProps): React.JSX.Element {
  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const isMultiCurrency =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  // Auto-calculate target amount if exchange rate exists and target amount is empty/zero
  // This logic normally lives in the parent form, but visual feedback is here

  const handleSwap = (): void => {
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
          className="bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md"
          activeOpacity={0.8}
        >
          <Ionicons
            name="swap-vertical"
            size={20}
            className="text-blue-500"
            color={palette.blue[500]}
          />
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

          <View className="flex-row items-center bg-white dark:bg-slate-800 rounded-2xl px-4 border border-blue-200 dark:border-blue-900/50 shadow-sm">
            <Text className="text-lg font-bold text-slate-400 mr-2">
              {toAccount?.currency}
            </Text>
            <TextInput
              value={targetAmount}
              onChangeText={onChangeTargetAmount}
              keyboardType="numeric"
              className="flex-1 py-4 text-xl font-extrabold text-slate-800 dark:text-white"
              placeholder="0.00"
              placeholderTextColor={palette.slate[400]}
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
