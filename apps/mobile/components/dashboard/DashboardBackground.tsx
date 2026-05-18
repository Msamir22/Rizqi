import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Image, useWindowDimensions, View } from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { dashboardAssets } from "@/components/dashboard/dashboard-assets";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { logger } from "@/utils/logger";

interface DashboardBackgroundProps {
  readonly children: React.ReactNode;
}

const INITIAL_TOP_INSET = initialWindowMetrics?.insets.top ?? 0;
const SKYLINE_HEIGHT = 320;

if (__DEV__ && !initialWindowMetrics) {
  logger.warn(
    "[DashboardBackground] initialWindowMetrics is null; top inset will use runtime fallback"
  );
}

export function DashboardBackground({
  children,
}: DashboardBackgroundProps): React.JSX.Element {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const runtimeInsets = useSafeAreaInsets();
  const topInset = Math.max(INITIAL_TOP_INSET, runtimeInsets.top);
  const imageSource = isDark
    ? dashboardAssets.cairoNileDark
    : dashboardAssets.cairoNileLight;
  const fadeColors: readonly [string, string] = isDark
    ? [`${palette.night[950]}00`, palette.night[950]]
    : [`${palette.paper[50]}00`, palette.paper[50]];
  return (
    <View className="flex-1 bg-app dark:bg-app-dark">
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor="transparent"
        translucent
      />
      <View
        style={{
          height: 360,
          left: 0,
          overflow: "hidden",
          position: "absolute",
          right: 0,
          top: 0,
          zIndex: 0,
        }}
      >
        <Image
          source={imageSource}
          resizeMode="stretch"
          style={{
            height: SKYLINE_HEIGHT,
            left: 0,
            opacity: isDark ? 1 : 0.64,
            position: "absolute",
            top: 0,
            width,
          }}
        />
        <LinearGradient
          colors={fadeColors}
          locations={[0.2, 1]}
          className="absolute inset-x-0 bottom-0 h-[160px]"
        />
      </View>
      <View className="flex-1 z-10" style={{ paddingTop: topInset }}>
        {children}
      </View>
    </View>
  );
}
