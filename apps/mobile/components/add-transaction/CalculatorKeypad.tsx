import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";

export type CalculatorKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "DEL"
  | "+"
  | "-"
  | "*"
  | "/"
  | "DONE";

interface CalculatorKeypadProps {
  onKeyPress: (key: CalculatorKey) => void;
  hide?: boolean;
}

const Key = ({
  label,
  value,
  onPress,
  className = "",
}: {
  label: string | React.ReactNode;
  value: CalculatorKey;
  onPress: (value: CalculatorKey) => void;
  className?: string;
}): React.JSX.Element => (
  <TouchableOpacity
    className={`h-[56px] items-center justify-center rounded-2xl mx-1 active:opacity-70 flex-1 bg-slate-100 dark:bg-slate-800/50 ${className}`}
    onPress={() => onPress(value)}
  >
    {typeof label === "string" ? (
      <Text className="text-xl font-bold text-slate-900 dark:text-white">
        {label}
      </Text>
    ) : (
      label
    )}
  </TouchableOpacity>
);

const OperationKey = ({
  label,
  value,
  onPress,
}: {
  label: string;
  value: CalculatorKey;
  onPress: (value: CalculatorKey) => void;
}): React.JSX.Element => (
  <Key
    label={label}
    value={value}
    onPress={onPress}
    className="bg-nileGreen-500/10 dark:bg-nileGreen-500/10"
  />
);

export function CalculatorKeypad({
  onKeyPress,
  hide,
}: CalculatorKeypadProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();

  if (hide) return null;

  return (
    <View
      className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-2xl"
      style={{ paddingBottom: insets.bottom + 8, paddingTop: 16 }}
    >
      {/* Row 1 */}
      <View className="flex-row mb-3 px-3">
        <Key label="1" value="1" onPress={onKeyPress} />
        <Key label="2" value="2" onPress={onKeyPress} />
        <Key label="3" value="3" onPress={onKeyPress} />
        <OperationKey label="÷" value="/" onPress={onKeyPress} />
      </View>

      {/* Row 2 */}
      <View className="flex-row mb-3 px-3">
        <Key label="4" value="4" onPress={onKeyPress} />
        <Key label="5" value="5" onPress={onKeyPress} />
        <Key label="6" value="6" onPress={onKeyPress} />
        <OperationKey label="×" value="*" onPress={onKeyPress} />
      </View>

      {/* Row 3 */}
      <View className="flex-row mb-3 px-3">
        <Key label="7" value="7" onPress={onKeyPress} />
        <Key label="8" value="8" onPress={onKeyPress} />
        <Key label="9" value="9" onPress={onKeyPress} />
        <OperationKey label="-" value="-" onPress={onKeyPress} />
      </View>

      {/* Row 4 */}
      <View className="flex-row px-3">
        <Key label="." value="." onPress={onKeyPress} />
        <Key label="0" value="0" onPress={onKeyPress} />
        <Key
          label={
            <Ionicons
              name="backspace-outline"
              size={24}
              className="text-red-500 dark:text-red-400"
              color={palette.red[500]}
            />
          }
          value="DEL"
          onPress={onKeyPress}
        />
        <OperationKey label="+" value="+" onPress={onKeyPress} />
      </View>

      {/* Bottom Row - DONE only */}
      <View className="flex-row mt-4 px-4">
        <TouchableOpacity
          className="flex-1 h-[56px] items-center justify-center rounded-2xl bg-nileGreen-500 active:opacity-80 shadow-md"
          onPress={() => onKeyPress("DONE")}
        >
          <Text className="text-white font-extrabold text-lg">Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
