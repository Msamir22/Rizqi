import { formatAmountInput } from "@astik/logic";
import { Text, TouchableOpacity, View } from "react-native";

interface AmountDisplayProps {
  amount: string;
  currency: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  mainColor?: string;
  /** The original amount before editing — shown as strikethrough when changed */
  originalAmount?: string;
  /** Called when the user taps the amount area (e.g. to re-open keypad) */
  onPress?: () => void;
}

export function AmountDisplay({
  amount,
  currency,
  type,
  mainColor,
  originalAmount,
  onPress,
}: AmountDisplayProps): React.JSX.Element {
  // Determine fallback color if mainColor is not provided
  let fallbackColorClass = "text-slate-900 dark:text-white";
  if (type === "EXPENSE") {
    fallbackColorClass = "text-red-500";
  } else if (type === "INCOME") {
    fallbackColorClass = "text-nileGreen-500";
  } else if (type === "TRANSFER") {
    fallbackColorClass = "text-blue-500";
  }

  const displayAmount = formatAmountInput(amount, "0");

  // Show original amount when it differs from the current amount
  const hasAmountChanged =
    originalAmount !== undefined && originalAmount !== amount;

  const content = (
    <>
      <Text
        className={`text-5xl font-extrabold tracking-tighter text-center ${!mainColor ? fallbackColorClass : ""}`}
        style={mainColor ? { color: mainColor } : {}}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {displayAmount}
      </Text>
      <Text className="text-lg font-bold mt-1 uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {currency}
      </Text>
      {hasAmountChanged && (
        <Text className="text-xs mt-1 text-slate-400 dark:text-slate-500 line-through">
          was {formatAmountInput(originalAmount, "0")}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="items-center justify-center py-6"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View className="items-center justify-center py-6">{content}</View>;
}
