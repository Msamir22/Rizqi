import { formatCurrency } from "@astik/logic";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Dimensions, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { palette } from "@/constants/colors";

interface Props {
  totalEgp: number | null;
  totalUsd: number | null;
  monthlyPercentageChange: number | null;
  isLoading: boolean;
}

const { width } = Dimensions.get("window");

export function TotalNetWorthCard({
  totalEgp,
  totalUsd,
  monthlyPercentageChange,
  isLoading,
}: Props): React.JSX.Element {
  // Determine arrow icon and color based on percentage change
  const isPositive =
    monthlyPercentageChange !== null && monthlyPercentageChange >= 0;
  const arrowIcon = isPositive ? "arrow-up" : "arrow-down";
  const arrowColor = isPositive ? palette.nileGreen[400] : palette.red[400];
  const arrowRotation = isPositive ? "40deg" : "-40deg";

  // Format percentage for display
  const monthlyPercentageChangeFormatted = monthlyPercentageChange
    ? `${monthlyPercentageChange >= 0 ? "+" : ""}${monthlyPercentageChange.toFixed(1)}%`
    : null;

  // Glow dimensions
  const glowWidth = width;
  const glowHeight = 60;

  return (
    <View className="relative my-2 items-center justify-center">
      {/* Bottom Glow */}
      <View
        style={{
          position: "absolute",
          bottom: -35,
          width: glowWidth,
          height: glowHeight,
          alignItems: "center",
          zIndex: -1,
        }}
      >
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient
              id="card-glow"
              cx="50%"
              cy="0%"
              rx="50%"
              ry="100%"
              fx="50%"
              fy="0%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop
                offset="0%"
                stopColor={palette.nileGreen[500]}
                stopOpacity="0.4"
              />
              <Stop
                offset="100%"
                stopColor={palette.nileGreen[500]}
                stopOpacity="0"
              />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#card-glow)" />
        </Svg>
      </View>

      <LinearGradient
        colors={[palette.nileGreen[800], palette.nileGreen[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="relative min-h-[180px] w-full items-center overflow-hidden rounded-2xl border border-white/10 p-6 shadow-lg"
      >
        {/* Geometric Background Pattern */}
        <View className="absolute bottom-0 left-0 right-0 top-0 overflow-hidden rounded-[24px]">
          <View className="absolute -bottom-20 -right-10 h-64 w-64 rotate-45 transform bg-white/5" />
          <View className="absolute bottom-10 -right-4 h-32 w-32 rotate-12 transform bg-white/5" />
          <View className="absolute -bottom-10 right-20 h-32 w-32 -rotate-12 transform bg-white/5" />
        </View>

        <View className="z-10 items-center gap-1">
          {/* Label */}
          <Text className="text-sm font-medium tracking-wide text-slate-300 opacity-90">
            Total Net Worth
          </Text>

          {/* Main Amount (EGP) */}
          {isLoading ? (
            <View className="my-3">
              <ActivityIndicator size="small" color="#FFF" />
            </View>
          ) : (
            <Text className="mt-1 text-[42px] font-extrabold tracking-tight text-white">
              {totalEgp
                ? formatCurrency({
                    amount: totalEgp,
                    currency: "EGP",
                  })
                : 0}
            </Text>
          )}

          {/* Secondary Amount (USD) */}
          <Text className="text-base font-medium text-slate-100 opacity-80">
            ≈
            {totalUsd
              ? formatCurrency({
                  amount: totalUsd,
                  currency: "USD",
                })
              : 0}
          </Text>

          {/* Monthly Percentage Change */}
          {monthlyPercentageChangeFormatted && (
            <View className="mt-2 flex-row items-center gap-1 rounded-full bg-white/10 px-3 py-1">
              <Ionicons
                name={arrowIcon}
                style={{ transform: [{ rotate: arrowRotation }] }}
                size={12}
                color={arrowColor}
              />
              <Text className="text-xs font-bold" style={{ color: arrowColor }}>
                {monthlyPercentageChangeFormatted} Month
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}
