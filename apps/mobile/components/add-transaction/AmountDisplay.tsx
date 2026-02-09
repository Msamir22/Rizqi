import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { formatCurrency } from "@astik/logic";
import * as React from "react";
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
}: AmountDisplayProps) {
  const { isDark } = useTheme();

  // Determine color based on type if not custom provided
  let color = isDark ? "#FFF" : "#0F172A";
  if (mainColor) {
    color = mainColor;
  } else if (type === "EXPENSE") {
    color = palette.red[500];
  } else if (type === "INCOME") {
    color = palette.nileGreen[500];
  } else {
    color = palette.blue[500];
  }

  // Format amount for display
  // If calculation active (e.g. "50+20"), show as is
  // Final amount should be formatted
  const isCalculation = /[\+\-\*\/]/.test(amount);

  const displayAmount = isCalculation ? amount : amount || "0";

  return (
    <View className="items-center justify-center py-6">
      <Text
        className="text-5xl font-bold tracking-tight text-center"
        style={{ color }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {displayAmount}
      </Text>
      <Text
        className="text-lg font-medium mt-1 uppercase"
        style={{ color: isDark ? palette.slate[400] : palette.slate[500] }}
      >
        {currency}
      </Text>
    </View>
  );
}
