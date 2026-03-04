import type { TransactionType } from "@astik/db";
import * as Haptics from "expo-haptics";
import { Text, TouchableOpacity, View } from "react-native";
import { palette } from "@/constants/colors";

type TabType = TransactionType | "TRANSFER";

interface TypeTabsProps {
  selectedType: TabType;
  onSelect: (type: TabType) => void;
  hideTransfer?: boolean;
  containerClassName?: string;
  tabClassName?: string;
}

export function TypeTabs({
  selectedType,
  onSelect,
  hideTransfer = false,
  containerClassName,
  tabClassName,
}: TypeTabsProps): JSX.Element {
  const allTabs: Array<{
    label: string;
    value: TabType;
    color: string;
  }> = [
    { label: "EXPENSE", value: "EXPENSE", color: palette.red[500] },
    { label: "INCOME", value: "INCOME", color: palette.nileGreen[500] },
    { label: "TRANSFER", value: "TRANSFER", color: palette.blue[500] },
  ];

  const tabs = hideTransfer
    ? allTabs.filter((t) => t.value !== "TRANSFER")
    : allTabs;

  return (
    <View
      className={`flex-row bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-full mx-6 mb-4 border border-slate-200 dark:border-slate-700 ${containerClassName ?? ""}`}
    >
      {tabs.map((tab) => {
        const isSelected = selectedType === tab.value;
        return (
          <TouchableOpacity
            key={tab.value}
            testID={`type-tab-${tab.value}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                console.error
              );
              onSelect(tab.value);
            }}
            activeOpacity={0.8}
            className={`flex-1 items-center justify-center py-2.5 rounded-full ${
              isSelected ? "" : "bg-transparent"
            } ${tabClassName ?? ""}`}
            style={{
              backgroundColor: isSelected ? tab.color : undefined,
            }}
          >
            <Text
              className={`text-xs font-extrabold tracking-widest ${
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
