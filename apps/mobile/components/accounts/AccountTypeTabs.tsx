import { ACCOUNT_TYPES } from "@/constants/accounts";
import { AccountType } from "@astik/db";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export type FilterType = AccountType | "ALL";

interface AccountTypeTabsProps {
  selectedFilter: FilterType;
  onSelectFilter: (filter: FilterType) => void;
}

export function AccountTypeTabs({
  selectedFilter,
  onSelectFilter,
}: AccountTypeTabsProps): React.JSX.Element {
  const filters: Array<{ id: FilterType; label: string }> = [
    { id: "ALL", label: "All" },
    ...ACCOUNT_TYPES.map((t) => ({ id: t.id, label: t.label })),
  ];

  return (
    <View className="mb-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {filters.map((filter) => {
          const isSelected = selectedFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              onPress={() => onSelectFilter(filter.id)}
              activeOpacity={0.8}
              className={`px-6 py-2.5 rounded-2xl border ${
                isSelected
                  ? "bg-nileGreen-500 border-nileGreen-500 shadow-md shadow-nileGreen-500/20"
                  : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
              }`}
            >
              <Text
                className={`text-xs font-extrabold tracking-widest uppercase ${
                  isSelected
                    ? "text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
