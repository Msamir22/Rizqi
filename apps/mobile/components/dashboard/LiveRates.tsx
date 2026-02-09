import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { formatTimeAgo } from "@/utils/dateHelpers";
import { MarketRate } from "@astik/db";
import { FontAwesome5, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

interface Rate {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  type: "currency" | "gold" | "silver";
}

interface LiveRatesProps {
  latestRates: MarketRate | null;
  previousDayRate: MarketRate | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  isStale: boolean;
}

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

/**
 * Calculate trend direction by comparing current vs previous values
 */
function calculateTrend(
  current: number,
  previous: number | null | undefined
): "up" | "down" | "flat" {
  if (previous === null || previous === undefined || previous === 0) {
    return "flat";
  }
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function buildRatesDisplay(
  latestRates: MarketRate | null,
  previousDayRate: MarketRate | null
): Rate[] {
  if (!latestRates) {
    return [];
  }

  return [
    {
      id: "1",
      label: "USD/EGP",
      value: latestRates.usdEgp.toFixed(2),
      trend: calculateTrend(latestRates.usdEgp, previousDayRate?.usdEgp),
      type: "currency",
    },
    {
      id: "2",
      label: "Gold 24K",
      value: `EGP ${Math.round(latestRates.goldEgpPerGram).toLocaleString()}/g`,
      trend: calculateTrend(
        latestRates.goldEgpPerGram,
        previousDayRate?.goldEgpPerGram
      ),
      type: "gold",
    },
    {
      id: "3",
      label: "Silver",
      value: `EGP ${Math.round(latestRates.silverEgpPerGram).toLocaleString()}/g`,
      trend: calculateTrend(
        latestRates.silverEgpPerGram,
        previousDayRate?.silverEgpPerGram
      ),
      type: "silver",
    },
  ];
}

export function LiveRates({
  latestRates,
  previousDayRate,
  isLoading = false,
  lastUpdated,
  isStale,
}: LiveRatesProps): React.JSX.Element {
  const { mode } = useTheme();
  const isDark = mode === "dark";

  const ratesDisplay = buildRatesDisplay(latestRates, previousDayRate);

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
      <View className="mb-3 flex-row items-center">
        <Text className="header-text ml-1">Live Rates</Text>
        {isLoading && (
          <ActivityIndicator
            size="small"
            className="ml-2"
            color={palette.nileGreen[500]}
          />
        )}
        {isStale && (
          <View className="ml-2 flex-row items-center">
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={palette.orange[500]}
            />
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
      >
        {ratesDisplay.map((rate) => {
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

              {rate.trend !== "flat" && (
                <MaterialIcons
                  name={
                    rate.trend === "up" ? "arrow-drop-up" : "arrow-drop-down"
                  }
                  size={22}
                  color={
                    rate.trend === "up"
                      ? palette.nileGreen[500]
                      : palette.red[500]
                  }
                  style={{ marginLeft: 2, marginRight: -4 }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
      {lastUpdated && (
        <Text className="ml-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
          Last updated {formatTimeAgo(lastUpdated)}
        </Text>
      )}
    </View>
  );
}
