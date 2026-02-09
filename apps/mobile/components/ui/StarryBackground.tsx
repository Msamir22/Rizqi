import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

interface Props {
  children: React.ReactNode;
}

interface StarConfig {
  id: number;
  top: number; // Percentage 0-1
  left: number; // Percentage 0-1
  size: number;
  colorClass: string;
  delay: number;
  duration: number;
}

const STATIC_STARS: StarConfig[] = [
  {
    id: 1,
    top: 0.17,
    left: 0.13,
    size: 1.5,
    colorClass: "bg-nileGreen-500",
    delay: 0,
    duration: 2000,
  },
  {
    id: 3,
    top: 0.17,
    left: 0.65,
    size: 1,
    colorClass: "bg-nileGreen-400",
    delay: 200,
    duration: 2200,
  },
  {
    id: 6,
    top: 0.17,
    left: 0.88,
    size: 0.5,
    colorClass: "bg-nileGreen-500",
    delay: 600,
    duration: 2100,
  },
  {
    id: 7,
    top: 0.3,
    left: 0.03,
    size: 1,
    colorClass: "bg-nileGreen-400",
    delay: 300,
    duration: 2500,
  },
  {
    id: 8,
    top: 0.52,
    left: 0.9,
    size: 1.5,
    colorClass: "bg-gold-400",
    delay: 900,
    duration: 2600,
  },
  {
    id: 9,
    top: 0.52,
    left: 0.5,
    size: 1,
    colorClass: "bg-gold-600",
    delay: 900,
    duration: 2600,
  },

  // Right side lower gutter
  {
    id: 10,
    top: 0.62,
    left: 0.92,
    size: 0.8,
    colorClass: "bg-nileGreen-500",
    delay: 700,
    duration: 2300,
  },
  // Bottom Left corner
  {
    id: 11,
    top: 0.88,
    left: 0.12,
    size: 1.4,
    colorClass: "bg-nileGreen-400",
    delay: 150,
    duration: 2800,
  },
  // Bottom Right corner
  {
    id: 12,
    top: 0.85,
    left: 0.88,
    size: 1.5,
    colorClass: "bg-gold-400",
    delay: 550,
    duration: 2000,
  },
  // Top very right edge
  {
    id: 13,
    top: 0.08,
    left: 0.92,
    size: 1.0,
    colorClass: "bg-nileGreen-300",
    delay: 800,
    duration: 2400,
  },
  // Mid-right slightly higher
  {
    id: 14,
    top: 0.3,
    left: 0.12,
    size: 2,
    colorClass: "bg-gold-400",
    delay: 850,
    duration: 2200,
  },
];

const COLOR_MAP: Record<string, string> = {
  "bg-nileGreen-400": palette.nileGreen[400],
  "bg-nileGreen-500": palette.nileGreen[500],
  "bg-gold-400": palette.gold[400],
  "bg-gold-600": palette.gold[600],
};

const Star = ({ data }: { data: StarConfig }): JSX.Element => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      data.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: data.duration, easing: Easing.ease }),
          withTiming(0.3, { duration: data.duration, easing: Easing.ease })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const color = COLOR_MAP[data.colorClass];

  // Render slightly larger to accommodate the glow
  const renderSize = data.size * 6; // Make glow radius significant
  const radius = renderSize / 2;

  return (
    <Animated.View
      className="absolute"
      style={[
        {
          left: `${data.left * 100}%`,
          top: `${data.top * 100}%`,
          width: renderSize,
          height: renderSize,
          transform: [
            { translateX: -renderSize / 2 },
            { translateY: -renderSize / 2 },
          ],
        },
        animatedStyle,
      ]}
    >
      <Svg height={renderSize} width={renderSize}>
        <Defs>
          <RadialGradient
            id={`grad-${data.id}`}
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fx="50%"
            fy="50%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="25%" stopColor={color} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle
          cx={radius}
          cy={radius}
          r={radius}
          fill={`url(#grad-${data.id})`}
        />
      </Svg>
    </Animated.View>
  );
};

export function StarryBackground({ children }: Props): JSX.Element {
  const { isDark } = useTheme();

  if (isDark) {
    return (
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={["top"]}>
          {STATIC_STARS.map((star) => (
            <Star key={star.id} data={star} />
          ))}
          <View className="flex-1 z-10">{children}</View>
        </SafeAreaView>
      </View>
    );
  }

  // Light mode fallback (Standard light background)
  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}
