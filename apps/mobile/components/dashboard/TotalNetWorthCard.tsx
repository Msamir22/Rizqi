import { TotalNetWorthSkeleton } from "@/components/dashboard/skeletons/TotalNetWorthSkeleton";
import { palette } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { CurrencyType } from "@monyvi/db";
import { formatCurrency } from "@monyvi/logic";
import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface Props {
  readonly totalNetWorth: number | null;
  readonly totalNetWorthUsd: number | null;
  readonly preferredCurrency: CurrencyType;
  readonly monthlyPercentageChange: number | null;
  readonly isLoading: boolean;
}

function TotalNetWorthCardComponent({
  totalNetWorth,
  totalNetWorthUsd,
  preferredCurrency,
  monthlyPercentageChange,
  isLoading,
}: Props): React.JSX.Element {
  const { t } = useTranslation("common");

  if (isLoading) {
    return <TotalNetWorthSkeleton />;
  }

  const isPositive =
    monthlyPercentageChange !== null && monthlyPercentageChange >= 0;
  const isPreferredCurrencyUSD = preferredCurrency === "USD";
  const monthlyPercentageChangeFormatted =
    monthlyPercentageChange !== null
      ? `${monthlyPercentageChange >= 0 ? "+" : ""}${monthlyPercentageChange.toFixed(1)}%`
      : null;
  const trendClassName = isPositive
    ? "text-success dark:text-success-dark"
    : "text-danger dark:text-danger-dark";
  const trendBgClassName = isPositive
    ? "bg-success dark:bg-success-dark"
    : "bg-danger dark:bg-danger-dark";

  return (
    <View className="mb-4 rounded-2xl border border-action bg-nileGreen-50 px-5 py-4 dark:border-border-glass-dark dark:bg-surface-dark">
      <View className="flex-row items-start">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-[17px] font-semibold text-text-primary dark:text-text-primary-dark">
              {t("total_net_worth")}
            </Text>
            <Ionicons
              name="eye-outline"
              size={20}
              color={palette.slate[500]}
              style={{ marginStart: 8 }}
            />
          </View>

          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            className="mt-3 text-[38px] font-black tracking-normal text-text-primary dark:text-text-primary-dark"
          >
            {formatCurrency({
              amount: totalNetWorth ?? 0,
              currency: preferredCurrency,
            })}
          </Text>

          {!isPreferredCurrencyUSD ? (
            <Text className="mt-1 text-[18px] text-text-secondary dark:text-text-secondary-dark">
              {`≈ ${formatCurrency({
                amount: totalNetWorthUsd ?? 0,
                currency: "USD",
              })}`}
            </Text>
          ) : null}

          {monthlyPercentageChangeFormatted ? (
            <View className="mt-4 flex-row items-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${trendBgClassName}`}
              >
                <Ionicons
                  name={isPositive ? "arrow-up" : "arrow-down"}
                  size={20}
                  color={palette.paper[25]}
                />
              </View>
              <Text
                className={`ms-3 text-[18px] font-semibold ${trendClassName}`}
              >
                {monthlyPercentageChangeFormatted}
              </Text>
              <Text className="ms-2 text-[15px] text-text-secondary dark:text-text-secondary-dark">
                {t("dashboard_vs_last_month")}
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={28} color={palette.slate[500]} />
      </View>
    </View>
  );
}

export const TotalNetWorthCard = React.memo(TotalNetWorthCardComponent);
