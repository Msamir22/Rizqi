import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

export function CalculatorKeypad({ onKeyPress, hide }: CalculatorKeypadProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  if (hide) return null;

  const Key = ({
    label,
    value,
    color,
    bg,
    flex = 1,
  }: {
    label: string | React.ReactNode;
    value: CalculatorKey;
    color?: string;
    bg?: string;
    flex?: number;
  }) => (
    <TouchableOpacity
      className={`h-[52px] items-center justify-center rounded-xl mx-1 active:opacity-70`}
      style={{
        flex,
        backgroundColor: bg || (isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9"),
      }}
      onPress={() => onKeyPress(value)}
    >
      {typeof label === "string" ? (
        <Text
          className="text-xl font-semibold"
          style={{ color: color || (isDark ? "#FFF" : "#0F172A") }}
        >
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
  }: {
    label: string;
    value: CalculatorKey;
  }) => (
    <Key
      label={label}
      value={value}
      color={isDark ? palette.nileGreen[400] : palette.nileGreen[600]}
      bg={isDark ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.1)"}
    />
  );

  return (
    <View
      className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
      style={{ paddingBottom: insets.bottom + 8, paddingTop: 12 }}
    >
      {/* Row 1 */}
      <View className="flex-row mb-2 px-2">
        <Key label="1" value="1" />
        <Key label="2" value="2" />
        <Key label="3" value="3" />
        <OperationKey label="÷" value="/" />
      </View>

      {/* Row 2 */}
      <View className="flex-row mb-2 px-2">
        <Key label="4" value="4" />
        <Key label="5" value="5" />
        <Key label="6" value="6" />
        <OperationKey label="×" value="*" />
      </View>

      {/* Row 3 */}
      <View className="flex-row mb-2 px-2">
        <Key label="7" value="7" />
        <Key label="8" value="8" />
        <Key label="9" value="9" />
        <OperationKey label="-" value="-" />
      </View>

      {/* Row 4 */}
      <View className="flex-row px-2">
        <Key label="." value="." />
        <Key label="0" value="0" />
        <Key
          label={
            <Ionicons
              name="backspace-outline"
              size={24}
              color={isDark ? "#FF6B6B" : "#DC2626"}
            />
          }
          value="DEL"
        />
        <OperationKey label="+" value="+" />
      </View>

      {/* Bottom Row - DONE only */}
      <View className="flex-row mt-2 px-3">
        <TouchableOpacity
          className="flex-1 h-[52px] items-center justify-center rounded-xl bg-nileGreen-600 active:opacity-80 shadow-sm"
          onPress={() => onKeyPress("DONE")}
        >
          <Text className="text-white font-bold text-lg">Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
