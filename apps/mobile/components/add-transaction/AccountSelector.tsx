import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Account } from "@astik/db";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface AccountSelectorProps {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  mainColor?: string;
}

export function AccountSelector({
  accounts,
  selectedId,
  onSelect,
  label,
  mainColor = palette.nileGreen[600],
}: AccountSelectorProps) {
  const { isDark } = useTheme();

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
          {label}
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
      >
        {accounts.map((account) => {
          const isSelected = account.id === selectedId;

          // Determine icon based on account type
          let iconName: keyof typeof Ionicons.glyphMap = "wallet-outline";
          if (account.type === "BANK") iconName = "business-outline";
          if (account.type === "DIGITAL_WALLET") iconName = "card-outline";

          return (
            <TouchableOpacity
              key={account.id}
              onPress={() => onSelect(account.id)}
              activeOpacity={0.7}
              className={`flex-row items-center px-4 py-3 rounded-xl border ${
                isSelected
                  ? "border-transparent"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "white",
                      borderColor: mainColor,
                      borderWidth: 2,
                    }
                  : {}
              }
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mr-2`}
                style={{
                  backgroundColor: isSelected
                    ? mainColor
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "#F1F5F9",
                }}
              >
                <Ionicons
                  name={iconName}
                  size={16}
                  color={isSelected ? "#FFF" : isDark ? "#A0AEC0" : "#64748B"}
                />
              </View>
              <View>
                <Text
                  className={`text-sm font-semibold ${
                    isSelected
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {account.name}
                </Text>
                {isSelected && (
                  <Text className="text-[10px] text-slate-400 dark:text-slate-500">
                    {account.currency}
                  </Text>
                )}
              </View>

              {isSelected && (
                <View className="ml-2 bg-white dark:bg-slate-900 rounded-full p-0.5">
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={mainColor}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
