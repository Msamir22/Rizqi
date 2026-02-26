import type { CurrencyType, MarketRate } from "@astik/db";
import { CURRENCY_INFO_MAP, getMetalPrice } from "@astik/logic";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { formatTimeAgo } from "@/utils/dateHelpers";

interface Rate {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  type: "currency" | "gold" | "silver";
}

interface LiveRatesProps {
  readonly latestRates: MarketRate | null;
  readonly previousDayRate: MarketRate | null;
  readonly isLoading: boolean;
  readonly lastUpdated: Date | null;
  readonly isStale: boolean;
  readonly preferredCurrency: CurrencyType;
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

/**
 * Build the list of live rate items (currency pair, gold, silver) formatted for display.
 *
 * If `latestRates` is null, returns an empty array.
 *
 * @param latestRates - Most recent market rates used to compute current display values
 * @param previousDayRate - Prior-day market rates used to determine trends; may be null
 * @param preferredCurrency - User's preferred currency; when `"USD"` this function uses `"EUR"` as the displayed currency pair base
 * @returns An array of three Rate entries:
 *  - a currency pair entry labeled `<displayCurrency>/USD` with adaptive decimal precision,
 *  - a "Gold 24K" entry showing the preferred-currency price per gram rounded and localized,
 *  - a "Silver" entry showing the preferred-currency price per gram with two decimals.
 */
function buildRatesDisplay(
  latestRates: MarketRate | null,
  previousDayRate: MarketRate | null,
  preferredCurrency: CurrencyType
): Rate[] {
  if (!latestRates) {
    return [];
  }

  // Show how many units of the preferred currency per 1 USD
  // e.g. EGP/USD = 47.50 means 1 USD buys 47.50 EGP
  // When preferred IS USD, show EUR/USD as a meaningful reference pair
  const displayCurrency: CurrencyType =
    preferredCurrency === "USD" ? "EUR" : preferredCurrency;
  const currencyRate = latestRates.getRate("USD", displayCurrency);
  const previousRate = previousDayRate
    ? previousDayRate.getRate("USD", displayCurrency)
    : null;

  const symbol =
    CURRENCY_INFO_MAP[preferredCurrency]?.symbol ?? preferredCurrency;

  const goldInPreferred = getMetalPrice("GOLD", latestRates, preferredCurrency);
  const silverInPreferred = getMetalPrice(
    "SILVER",
    latestRates,
    preferredCurrency
  );

  const prevGoldInPreferred = previousDayRate
    ? getMetalPrice("GOLD", previousDayRate, preferredCurrency)
    : null;
  const prevSilverInPreferred = previousDayRate
    ? getMetalPrice("SILVER", previousDayRate, preferredCurrency)
    : null;

  return [
    {
      id: "1",
      label: `${displayCurrency}/USD`,
      value: currencyRate.toFixed(2),
      trend: calculateTrend(currencyRate, previousRate),
      type: "currency",
    },
    {
      id: "2",
      label: "Gold 24K",
      value: `${symbol} ${Math.round(goldInPreferred).toLocaleString()}/g`,
      trend: calculateTrend(goldInPreferred, prevGoldInPreferred),
      type: "gold",
    },
    {
      id: "3",
      label: "Silver",
      value: `${symbol} ${silverInPreferred.toFixed(2)}/g`,
      trend: calculateTrend(silverInPreferred, prevSilverInPreferred),
      type: "silver",
    },
  ];
}

/**
 * Selects the React element used as the icon inside a rate pill.
 *
 * Uses the preferredCurrency to determine which flag to show for currency pills
 * (treats `"USD"` as `"EUR"` for flag selection).
 *
 * @param type - The rate item type ("currency", "gold", or "silver")
 * @param color - Color to apply to icon glyphs (ignored for flag text)
 * @param preferredCurrency - The user's preferred currency used to pick a flag
 * @returns A React element to render inside the pill (flag text for currency, coin icons for gold/silver), or `null` if the type is unrecognized
 */
function getPillIcon(
  type: Rate["type"],
  color: string,
  preferredCurrency: CurrencyType
): React.ReactElement | null {
  const displayCurrency =
    preferredCurrency === "USD" ? "EUR" : preferredCurrency;
  const flag = CURRENCY_INFO_MAP[displayCurrency]?.flag ?? "🌐";
  switch (type) {
    case "currency":
      return <Text className="text-sm">{flag}</Text>;
    case "gold":
      return <FontAwesome5 name="coins" size={14} color={color} />;
    case "silver":
      return <FontAwesome5 name="coins" size={12} color={color} solid />;
    default:
      return null;
  }
}

/**
 * Render a horizontal list of live currency and precious-metal rates as pill-style UI.
 *
 * Displays loading and staleness indicators, adapts labels and values to `preferredCurrency`,
 * and optionally shows a "Last updated" timestamp when `lastUpdated` is provided.
 *
 * @returns The React element rendering the live rates pills, status indicators, and timestamp.
 */
export function LiveRates({
  latestRates,
  previousDayRate,
  isLoading = false,
  lastUpdated,
  isStale,
  preferredCurrency,
}: LiveRatesProps): React.ReactElement {
  const { isDark } = useTheme();
  const ratesDisplay = buildRatesDisplay(
    latestRates,
    previousDayRate,
    preferredCurrency
  );

  return (
    <View className="my-3">
      <View className="mb-3 flex-row items-center">
        <Text className="header-text ml-1 text-slate-800 dark:text-slate-50">
          Live Rates
        </Text>
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
          const iconColor =
            rate.type === "gold"
              ? isDark
                ? palette.gold[400]
                : palette.gold[600]
              : isDark
                ? palette.slate[400]
                : palette.slate[600];

          return (
            <View
              key={rate.id}
              className={`flex-row items-center rounded-full px-3 py-2 ${config.container}`}
            >
              <View className="mr-1.5">
                {getPillIcon(rate.type, iconColor, preferredCurrency)}
              </View>

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
