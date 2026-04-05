import { Account, AccountType } from "@astik/db";
import { AssetBreakdownPercentage } from "@astik/logic";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Carousel from "react-native-reanimated-carousel";
import Svg, { Circle, G } from "react-native-svg";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");

// =============================================================================
// Types
// =============================================================================

type AccountDisplayType = "bank" | "cash" | "wallet";

interface AccountsCarouselProps {
  accounts: Account[];
  assetBreakdown: AssetBreakdownPercentage[];
  isLoading: boolean;
}

interface AccountCardData {
  id: string;
  name: string;
  balance: string;
  type: AccountDisplayType;
  color: string;
  gradient: [string, string];
}

interface AssetBreakdownDisplay {
  label: string;
  value: string;
  percentage: number;
  color: string;
}

interface AccountDisplayInfo {
  displayType: AccountDisplayType;
  color: string;
  gradient: [string, string];
}

interface AccountCardProps {
  item: AccountCardData;
  isDark: boolean;
}

interface RingChartProps {
  data: AssetBreakdownDisplay;
  isDark: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getAccountTypeInfo(type: AccountType): AccountDisplayInfo {
  switch (type) {
    case "BANK":
      return {
        displayType: "bank",
        color: palette.blue[500],
        gradient: [palette.blue[800], palette.blue[900]],
      };
    case "DIGITAL_WALLET":
      return {
        displayType: "wallet",
        color: palette.violet[500],
        gradient: [palette.violet[700], palette.violet[800]],
      };
    case "CASH":
    default:
      return {
        displayType: "cash",
        color: palette.nileGreen[500],
        gradient: [palette.nileGreen[600], palette.nileGreen[800]],
      };
  }
}

function formatBreakdownValue(value: number): string {
  if (value >= 1000) {
    return `EGP ${Math.round(value / 1000)}K`;
  }
  return `EGP ${Math.round(value)}`;
}

function getBreakdownColor(label: string): string {
  switch (label) {
    case "Bank":
      return palette.blue[500];
    case "Cash":
      return palette.nileGreen[500];
    case "Metals":
      return palette.gold[400];
    default:
      return palette.slate[500];
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

function AccountCard({ item, isDark }: AccountCardProps): React.JSX.Element {
  const Content = (): React.JSX.Element => (
    <>
      <View
        className="mb-2 h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: isDark
            ? "rgba(255,255,255,0.15)"
            : `${item.color}20`,
        }}
      >
        <FontAwesome5
          name={
            item.type === "bank"
              ? "university"
              : item.type === "wallet"
                ? "mobile-alt"
                : "wallet"
          }
          size={20}
          color={isDark ? "#FFF" : item.color}
        />
      </View>
      <View className="gap-0.5">
        <Text className="text-xs font-medium text-slate-600 dark:text-white/70">
          {item.name}
        </Text>
        <Text className="text-lg font-bold text-slate-800 dark:text-white">
          {item.balance}
        </Text>
      </View>
    </>
  );

  return (
    <TouchableOpacity activeOpacity={0.9}>
      {isDark ? (
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: width / 3 - 10 }}
          className="h-[120px] justify-between rounded-2xl border border-white/10 p-3.5"
        >
          <Content />
        </LinearGradient>
      ) : (
        <View
          style={{ width: width / 3 - 10 }}
          className="h-[120px] justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
        >
          <Content />
        </View>
      )}
    </TouchableOpacity>
  );
}

function RingChart({ data, isDark }: RingChartProps): React.JSX.Element {
  const size = 90;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (data.percentage / 100) * circumference;

  return (
    <View className="items-center gap-1.5">
      <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {data.label}
      </Text>
      <View
        className="items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isDark ? `${data.color}30` : `${data.color}20`}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={data.color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View className="absolute items-center">
          <Text className="text-sm font-bold" style={{ color: data.color }}>
            {data.percentage}%
          </Text>
          <Text className="text-[10px] font-semibold text-slate-700 dark:text-white">
            {data.value}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AddButton(): React.JSX.Element {
  const { t } = useTranslation("common");
  const handleAddPress = (): void => {
    router.push("/add-account");
  };

  return (
    <TouchableOpacity
      onPress={handleAddPress}
      activeOpacity={0.7}
      className="button"
    >
      <Feather name="plus" size={14} color="#FFFFFF" />
      <Text className="button-text ms-1">{t("add")}</Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AccountsCarousel({
  accounts,
  assetBreakdown,
  isLoading,
}: AccountsCarouselProps): React.JSX.Element {
  const { isDark } = useTheme();
  const { t } = useTranslation("common");
  const [activeIndex, setActiveIndex] = useState(0);

  // Dynamic header based on carousel position
  const headerText = activeIndex === 0 ? t("accounts") : t("asset_breakdown");

  // Transform accounts to card data
  const accountCards: AccountCardData[] = useMemo(() => {
    return accounts.map((acc) => {
      const typeInfo = getAccountTypeInfo(acc.type);
      return {
        id: acc.id,
        name: acc.name,
        balance: acc.formattedBalance,
        type: typeInfo.displayType,
        color: typeInfo.color,
        gradient: typeInfo.gradient,
      };
    });
  }, [accounts]);

  // Transform asset breakdown for display
  const breakdownDisplay: AssetBreakdownDisplay[] = useMemo(() => {
    return assetBreakdown.map((item) => ({
      label: item.label,
      value: formatBreakdownValue(item.value),
      percentage: item.percentage,
      color: getBreakdownColor(item.label),
    }));
  }, [assetBreakdown]);

  const renderItem = ({ index }: { index: number }): React.JSX.Element => {
    if (index === 0) {
      if (isLoading) {
        return (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color={palette.nileGreen[500]} />
          </View>
        );
      }

      if (accountCards.length === 0) {
        return (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              {t("no_accounts_carousel")}
            </Text>
          </View>
        );
      }

      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 3, gap: 5 }}
        >
          {accountCards.map((acc) => (
            <AccountCard key={acc.id} item={acc} isDark={isDark} />
          ))}
        </ScrollView>
      );
    }

    // Asset Breakdown view
    return (
      <View className="w-full flex-row justify-around px-4">
        {breakdownDisplay.map((asset, i) => (
          <RingChart key={i} data={asset} isDark={isDark} />
        ))}
      </View>
    );
  };

  return (
    <View className="my-3">
      <View className="mb-3 ms-1 flex-row items-center justify-between">
        <Text className="header-text">{headerText}</Text>
        {activeIndex === 0 && <AddButton />}
      </View>

      <Carousel
        width={width}
        height={120}
        data={[0, 1]}
        renderItem={renderItem}
        onSnapToItem={(index) => setActiveIndex(index)}
        loop={true}
      />

      <View className="mt-2 flex-row justify-center gap-1.5">
        {[0, 1].map((_, i) => (
          <View
            key={i}
            className={`h-1 rounded-full ${i === activeIndex ? "w-5 bg-action" : "w-2 bg-text-secondary/40"}`}
          />
        ))}
      </View>
    </View>
  );
}
