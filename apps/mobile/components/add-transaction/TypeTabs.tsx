import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { TransactionType } from "@astik/db";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface TypeTabsProps {
  selectedType: TransactionType | "TRANSFER";
  onSelect: (type: TransactionType | "TRANSFER") => void;
}

export function TypeTabs({ selectedType, onSelect }: TypeTabsProps) {
  const { isDark } = useTheme();

  const tabs: { label: string; value: TransactionType; color: string }[] = [
    { label: "EXPENSE", value: "EXPENSE", color: palette.red[500] },
    { label: "INCOME", value: "INCOME", color: palette.nileGreen[500] },
    { label: "TRANSFER", value: "TRANSFER", color: palette.blue[500] },
  ];

  return (
    <View className="flex-row bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-4 mx-4">
      {tabs.map((tab) => {
        const isSelected = selectedType === tab.value;
        return (
          <TouchableOpacity
            key={tab.value}
            onPress={() => onSelect(tab.value)}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center py-2.5 rounded-xl`}
            style={{
              backgroundColor: isSelected ? tab.color : "transparent",
            }}
          >
            <Text
              className={`text-xs font-bold tracking-wide ${
                isSelected ? "text-white" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
