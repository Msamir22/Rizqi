import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "@/constants/colors";
import { PitchMockCard } from "./PitchMockCard";

/**
 * Mock card for the Live Market pitch slide.
 *
 * Mirrors `specs/026-onboarding-restructure/mockups/03-slide-live-market.png`:
 *  - "NET WORTH" eyebrow.
 *  - Big "EGP 342,180" amount + green "+2.1% ↑" pill on the right.
 *  - Line-chart silhouette (simplified bar approximation — RN-friendly stand-in).
 *  - 3 asset rows: bullet + label + value with directional arrow.
 *  - Footer caption: "live · updated 2 min ago".
 *
 * Numeric / currency / change values are mock illustrations and are NOT
 * translated — see `// i18n-ignore` comments.
 */
interface MarketRow {
  readonly key: string;
  readonly bulletColor: string;
  readonly labelKey: string;
  readonly value: string;
  readonly change: "up" | "down" | "flat";
  readonly tone: "amber" | "slate" | "green" | "red";
}

const MARKET_ROWS: readonly MarketRow[] = [
  {
    key: "gold",
    bulletColor: "#F59E0B",
    labelKey: "pitch_slide_live_market_gold_label",
    value: "4,218 EGP/g",
    change: "up",
    tone: "amber",
  },
  {
    key: "silver",
    bulletColor: "#94A3B8",
    labelKey: "pitch_slide_live_market_silver_label",
    value: "54.20 EGP/g",
    change: "down",
    tone: "red",
  },
  {
    key: "usd",
    bulletColor: "#3B82F6",
    labelKey: "pitch_slide_live_market_usd_label",
    value: "49.82",
    change: "flat",
    tone: "slate",
  },
];

const TONE_CLASS: Record<MarketRow["tone"], string> = {
  amber: "text-amber-600 dark:text-amber-400",
  slate: "text-slate-600 dark:text-slate-300",
  green: "text-nileGreen-600 dark:text-nileGreen-400",
  red: "text-red-500 dark:text-red-400",
};

const CHANGE_ICON: Record<
  MarketRow["change"],
  "arrow-up" | "arrow-down" | "remove"
> = {
  up: "arrow-up",
  down: "arrow-down",
  flat: "remove",
};

/** Tiny inline "chart" — 6 sparkline bars with rising-trend heights. */
function ChartSparkline(): React.ReactElement {
  const heights = [12, 18, 14, 22, 28, 34];
  return (
    <View className="flex-row items-end" style={{ gap: 4, height: 36 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          className="w-2 rounded-sm bg-nileGreen-500/70"
          style={{ height: h }}
        />
      ))}
    </View>
  );
}

export function Slide3LiveMarket(): React.ReactElement {
  const { t } = useTranslation("onboarding");

  return (
    <PitchMockCard>
      {/* Net worth header */}
      <Text className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {t("pitch_slide_live_market_net_worth_label")}
      </Text>

      <View className="mt-1 flex-row items-end justify-between">
        <Text className="text-2xl font-bold text-slate-900 dark:text-white">
          {/* i18n-ignore: ISO currency code + numeric mock value. */}
          EGP 342,180
        </Text>
        <View
          className="flex-row items-center rounded-full bg-nileGreen-500/15 px-2 py-0.5"
          style={{ gap: 2 }}
        >
          <Text className="text-[10px] font-semibold text-nileGreen-700 dark:text-nileGreen-300">
            {/* i18n-ignore: mock percentage display. */}
            +2.1%
          </Text>
          <Ionicons name="arrow-up" size={10} color={palette.nileGreen[600]} />
        </View>
      </View>

      {/* Sparkline chart */}
      <View className="mt-3">
        <ChartSparkline />
      </View>

      {/* Asset rows */}
      <View className="mt-3" style={{ gap: 8 }}>
        {MARKET_ROWS.map((row) => (
          <View key={row.key} className="flex-row items-center">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: row.bulletColor }}
            />
            <Text className="ms-2 flex-1 text-sm text-slate-700 dark:text-slate-200">
              {t(row.labelKey)}
            </Text>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Text className={`text-sm font-semibold ${TONE_CLASS[row.tone]}`}>
                {/* i18n-ignore: numeric mock value with currency-per-unit suffix. */}
                {row.value}
              </Text>
              <Ionicons
                name={CHANGE_ICON[row.change]}
                size={10}
                color={
                  row.tone === "amber"
                    ? "#F59E0B" // amber-500 — not in the project palette today
                    : row.tone === "red"
                      ? "#EF4444"
                      : palette.slate[400]
                }
              />
            </View>
          </View>
        ))}
      </View>

      {/* Live caption */}
      <Text className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
        {t("pitch_slide_live_market_live_caption", { minutes: 2 })}
      </Text>
    </PitchMockCard>
  );
}
