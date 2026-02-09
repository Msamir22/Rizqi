import { Text, View } from "react-native";

interface AmountDisplayProps {
  amount: string;
  currency: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  mainColor?: string;
}

export function AmountDisplay({
  amount,
  currency,
  type,
  mainColor,
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

  // Format amount for display
  // If calculation active (e.g. "50+20"), show as is
  // Final amount should be formatted
  /* eslint-disable-next-line no-useless-escape */
  const isCalculation = /[\+\-\*\/]/.test(amount);

  const displayAmount = isCalculation ? amount : amount || "0";

  return (
    <View className="items-center justify-center py-6">
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
    </View>
  );
}
