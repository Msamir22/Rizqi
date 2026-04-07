import { palette } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { TextField } from "../ui/TextField";

interface BankDetailsSectionProps {
  expanded: boolean;
  onToggleExpand: () => void;
  bankName: string;
  cardLast4: string;
  cardLast4Error?: string;
  smsSenderName: string;
  onBankNameChange: (value: string) => void;
  onCardLast4Change: (value: string) => void;
  onSmsSenderNameChange: (value: string) => void;
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
  smsSenderName,
  onBankNameChange,
  onCardLast4Change,
  onSmsSenderNameChange,
}: BankDetailsSectionProps): JSX.Element {
  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.7}
        className="flex-row items-center justify-center py-5 mt-2 bg-slate-100 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700"
      >
        <Ionicons
          name="card-outline"
          size={20}
          color={palette.nileGreen[500]}
        />
        <Text className="ms-2.5 text-sm font-bold text-slate-700 dark:text-slate-300">
          Add bank details (Optional)
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={palette.slate[400]}
          style={{ marginStart: 6 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.7}
        className="flex-row items-center justify-center mb-6"
      >
        <Text className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Hide Bank Details
        </Text>
        <Ionicons
          name="chevron-up"
          size={14}
          color={palette.slate[400]}
          style={{ marginStart: 4 }}
        />
      </TouchableOpacity>

      <View className="mb-6 px-1">
        <Text className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">
          BANK DETAILS
        </Text>
        <Text className="text-xs font-bold text-slate-400 dark:text-slate-500">
          We&apos;ll auto-detect transactions from this card
        </Text>
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
        <Text className="mt-2 ms-2 text-[11px] font-bold text-slate-500 dark:text-slate-600">
          Found on your card: ****1234
        </Text>
      </View>

      <View className="mb-6">
        <TextField
          label="SMS Sender Name"
          placeholder="e.g., CIB, NBE, VFCash"
          value={smsSenderName}
          onChangeText={onSmsSenderNameChange}
          maxLength={100}
        />
        <Text className="mt-2 ms-2 text-[11px] font-bold text-slate-500 dark:text-slate-600">
          The name that appears as the SMS sender when your bank sends you
          transaction notifications. This helps us automatically match SMS
          transactions to this account.
        </Text>
      </View>
    </View>
  );
}
