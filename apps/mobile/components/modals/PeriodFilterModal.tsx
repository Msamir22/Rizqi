import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { palette } from "@/constants/colors";
import { GroupingPeriod } from "@/hooks/useTransactionsGrouping";
import { useTranslation } from "react-i18next";

interface PeriodFilterModalProps {
  visible: boolean;
  selectedPeriod: GroupingPeriod;
  onSelect: (period: GroupingPeriod) => void;
  onClose: () => void;
}

const PERIOD_OPTIONS: Array<{ value: GroupingPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "six_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
];

export function PeriodFilterModal({
  visible,
  selectedPeriod,
  onSelect,
  onClose,
}: PeriodFilterModalProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useTranslation("common");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="rounded-t-3xl overflow-hidden max-h-[70%] bg-white dark:bg-slate-900">
            <BlurView
              intensity={40}
              tint={isDark ? "dark" : "light"}
              className="absolute inset-0"
            />
            <View className="absolute inset-0 bg-white/95 dark:bg-slate-900/95" />

            <View>
              {/* Header */}
              <View className="flex-row justify-between items-center px-5 py-5 border-b border-slate-200 dark:border-slate-800">
                <Text className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {t("select_period")}
                </Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? palette.slate[300] : palette.slate[500]}
                  />
                </TouchableOpacity>
              </View>

              {/* Options - 2 columns grid */}
              <View className="p-4">
                <View className="flex-row flex-wrap gap-3">
                  {PERIOD_OPTIONS.map((option) => {
                    const isSelected = selectedPeriod === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        className={`flex-row items-center justify-center px-4 py-3 rounded-xl border ${
                          isSelected
                            ? "bg-nileGreen-100 dark:bg-nileGreen-900/40 border-nileGreen-500 dark:border-nileGreen-600"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                        style={{ width: "48%" }}
                        onPress={() => {
                          onSelect(option.value);
                          onClose();
                        }}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={
                              isDark
                                ? palette.nileGreen[400]
                                : palette.nileGreen[600]
                            }
                            style={{ marginEnd: 6 }}
                          />
                        )}
                        <Text
                          className={`text-sm font-medium ${
                            isSelected
                              ? "text-nileGreen-700 dark:text-nileGreen-400 font-semibold"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
