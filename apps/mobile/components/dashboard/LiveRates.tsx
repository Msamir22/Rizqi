import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";

interface Rate {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  type: "currency" | "gold" | "silver";
}

const MOCK_RATES: Rate[] = [
  { id: "1", label: "USD/EGP", value: "50.02", trend: "up", type: "currency" },
  {
    id: "2",
    label: "Gold 24K",
    value: "EGP 4,250/g",
    trend: "up",
    type: "gold",
  },
  {
    id: "3",
    label: "Silver",
    value: "EGP 52/g",
    trend: "down",
    type: "silver",
  },
];

// Pill style configurations using Tailwind classes
const pillConfig = {
  currency: {
    container: "bg-slate-100 dark:bg-slate-700/30",
    label: "text-slate-700 dark:text-slate-300",
  },
  gold: {
    container: "bg-gold-50 dark:bg-gold-400/20",
    label: "text-gold-800 dark:text-gold-400",
  },
  silver: {
    container: "bg-silver-bg dark:bg-slate-500/20",
    label: "text-slate-600 dark:text-slate-400",
  },
};

export function LiveRates(): React.JSX.Element {
  const { mode } = useTheme();
  const isDark = mode === "dark";

  const getIconColor = (type: Rate["type"]): string => {
    switch (type) {
      case "currency":
        return isDark ? palette.slate[400] : palette.slate[600];
      case "gold":
        return isDark ? palette.gold[400] : palette.gold[600];
      case "silver":
        return isDark ? palette.slate[400] : palette.silver[500];
    }
  };

  const getIcon = (type: Rate["type"], color: string): React.JSX.Element => {
    switch (type) {
      case "currency":
        return <Text className="text-sm">🇺🇸</Text>;
      case "gold":
        return <FontAwesome5 name="coins" size={14} color={color} />;
      case "silver":
        return <FontAwesome5 name="coins" size={12} color={color} solid />;
    }
  };

  return (
    <View className="my-3">
      <Text className="ml-1 mb-3 header-text">Live Rates</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
      >
        {MOCK_RATES.map((rate) => {
          const config = pillConfig[rate.type];
          const iconColor = getIconColor(rate.type);
          return (
            <View
              key={rate.id}
              className={`flex-row items-center rounded-full px-3 py-2 ${config.container}`}
            >
              <View className="mr-1.5">{getIcon(rate.type, iconColor)}</View>

              <Text className={`mr-1 text-[13px] font-medium ${config.label}`}>
                {rate.label}:
              </Text>
              <Text className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {rate.value}
              </Text>

              <MaterialIcons
                name={rate.trend === "up" ? "arrow-drop-up" : "arrow-drop-down"}
                size={22}
                color={
                  rate.trend === "up"
                    ? palette.nileGreen[500]
                    : palette.red[500]
                }
                style={{ marginLeft: 2, marginRight: -4 }}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
