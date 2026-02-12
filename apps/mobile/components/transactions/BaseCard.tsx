import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";
import { palette } from "@/constants/colors";
import { CategoryIcon, IconLibrary } from "../common/CategoryIcon";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

interface BaseCardProps {
  id: string;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  mainColor: string;
  iconName: string;
  iconLibrary: IconLibrary;
  title: string;
  amount: string;
  subtitle: string;
  isExpense: boolean;
  isIncome: boolean;
  counterparty?: string;
  details?: string;
  displayNetWorth: number;
  date: Date;
  // New Props
  index?: number;
  onSwipeDelete?: (id: string) => void;
  onCategoryPress?: (id: string) => void;
  onAmountPress?: (id: string) => void;
}

export function BaseCard({
  id,
  isSelectionMode,
  isSelected,
  onPress,
  onLongPress,
  mainColor,
  iconName,
  iconLibrary,
  title,
  amount,
  subtitle,
  counterparty,
  isExpense,
  details,
  displayNetWorth,
  date,
  onCategoryPress,
  onAmountPress,
}: BaseCardProps): React.JSX.Element {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(id)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
          console.error
        );
        onLongPress(id);
      }}
      style={{ borderLeftColor: mainColor }}
      className={`bg-white dark:bg-slate-800 rounded-2xl mb-2 mx-4 p-3 shadow-sm border-t border-r border-b border-slate-200 dark:border-slate-700 border-l-4 ${
        isSelected
          ? "border-nileGreen-500 bg-nileGreen-50 dark:bg-nileGreen-900/25"
          : ""
      }`}
    >
      <View className="flex-row items-center">
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <View className="mr-3">
            <Ionicons
              name={isSelected ? "checkbox" : "square-outline"}
              size={24}
              color={
                isSelected
                  ? palette.nileGreen[500]
                  : isDark
                    ? palette.slate[500]
                    : palette.slate[400]
              }
            />
          </View>
        )}

        {/* Icon */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onCategoryPress?.(id)}
          disabled={!onCategoryPress || isSelectionMode}
          className="w-10 h-10 rounded-full items-center justify-center mr-3 relative"
          style={{ backgroundColor: `${mainColor}20` }}
        >
          <CategoryIcon
            iconName={iconName}
            iconLibrary={iconLibrary}
            size={20}
            color={mainColor}
          />
          {!isSelectionMode && onCategoryPress && (
            <View className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700">
              <Ionicons
                name="pencil"
                size={8}
                color={isDark ? palette.slate[400] : palette.slate[500]}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Content */}
        <View className="flex-1">
          {/* Title Row */}
          <View className="flex-row justify-between items-center mb-1">
            <Text
              className="text-[15px] font-semibold text-slate-800 dark:text-slate-50 flex-1 mr-2"
              numberOfLines={1}
            >
              {title}
            </Text>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => onAmountPress?.(id)}
              disabled={!onAmountPress || isSelectionMode}
              className="flex-row items-center gap-1"
            >
              <Text
                className="text-[15px] font-bold"
                style={{ color: mainColor }}
              >
                {amount}
              </Text>
              {!isSelectionMode && onAmountPress && (
                <View className="ml-1">
                  <Ionicons
                    name="pencil"
                    size={10}
                    style={{ color: mainColor }}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Details Row */}
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-2">
              {/* Subtitle (Account name) */}
              <Text
                className="text-xs font-medium text-slate-500 dark:text-slate-300 mb-0.5"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
              {/* Merchant (if present) */}
              {counterparty && (
                <Text
                  className="text-[11px] text-slate-400 dark:text-slate-400 mb-0.5"
                  numberOfLines={1}
                >
                  {isExpense
                    ? "Merchant: " + counterparty
                    : "Payer: " + counterparty}
                </Text>
              )}
              {/* Details/Note (optional) */}
              {details && (
                <Text
                  className="text-[13px] text-slate-400 dark:text-slate-400"
                  numberOfLines={1}
                >
                  {details}
                </Text>
              )}
            </View>

            {/* Footer - NW + Date */}
            <View className="items-end">
              <View className="flex-row items-center">
                <Text className="text-[11px] text-slate-400 dark:text-slate-500">
                  NW:{" "}
                </Text>
                <Text className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {formatCurrency({
                    amount: displayNetWorth,
                    currency: "EGP",
                  })}
                </Text>
              </View>
              <Text className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {date.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
