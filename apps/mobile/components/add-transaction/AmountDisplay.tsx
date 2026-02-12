import { Text, TouchableOpacity, View } from "react-native";

interface AmountDisplayProps {
  amount: string;
  currency: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  mainColor?: string;
  /** Called when the user taps the amount area (e.g. to re-open keypad) */
  onPress?: () => void;
}

/**
 * Formats a numeric string with thousand separators (commas).
 * Handles expressions with operators by formatting each numeric segment individually.
 * Examples: "5000" → "5,000", "50000+200" → "50,000+200", "1000.50" → "1,000.50"
 */
export function formatWithCommas(value: string): string {
  if (!value) return "0";

  // Split by operators while keeping the operators in the result
  const parts = value.split(/([+\-*/])/);

  return parts
    .map((part) => {
      // If it's an operator, return as-is
      if (["+", "-", "*", "/"].includes(part)) return part;

      // If it's a number, format with commas
      if (part === "" || part === ".") return part;

      const [integerPart, decimalPart] = part.split(".");
      const formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ","
      );

      return decimalPart !== undefined
        ? `${formattedInteger}.${decimalPart}`
        : formattedInteger;
    })
    .join("");
}

export function AmountDisplay({
  amount,
  currency,
  type,
  mainColor,
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

  const displayAmount = formatWithCommas(amount);

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
