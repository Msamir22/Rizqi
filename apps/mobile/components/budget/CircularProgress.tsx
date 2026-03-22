/**
 * CircularProgress Component
 *
 * Reusable SVG circular progress ring with color-coded thresholds
 * (green/amber/red), animated transitions, and inner percentage text.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component
 * - Why: Pure UI — receives metrics, renders visual. No business logic.
 * - SOLID: SRP — renders only the progress ring.
 *
 * @module CircularProgress
 */

import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { ProgressStatus } from "@astik/logic/src/budget";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CircularProgressProps {
  /** Percentage filled (0-100+). Clamped to 100 for visual display. */
  readonly percentage: number;
  /** Visual status for color coding */
  readonly status: ProgressStatus;
  /** Diameter of the ring in pixels */
  readonly size?: number;
  /** Width of the ring stroke */
  readonly strokeWidth?: number;
  /** Whether to show the percentage text in the center */
  readonly showPercentage?: boolean;
  /** Optional label below percentage (e.g., "spent") */
  readonly label?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SIZE = 120;
const DEFAULT_STROKE_WIDTH = 10;
const ANIMATION_DURATION_MS = 800;

const STATUS_COLORS: Record<ProgressStatus, string> = {
  safe: palette.nileGreen[500],
  warning: palette.gold[600],
  danger: palette.red[500],
};

const TRACK_COLOR_LIGHT = palette.slate[200];
const TRACK_COLOR_DARK = palette.slate[700];

// ---------------------------------------------------------------------------
// Animated Components
// ---------------------------------------------------------------------------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CircularProgress({
  percentage,
  status,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  showPercentage = true,
  label,
}: CircularProgressProps): React.JSX.Element {
  const { isDark } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Clamp display percentage to 100 for the ring
  const displayPercentage = Math.max(0, Math.min(percentage, 100));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(displayPercentage / 100, {
      duration: ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [displayPercentage, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const progressColor = STATUS_COLORS[status];
  const trackColor = isDark ? TRACK_COLOR_DARK : TRACK_COLOR_LIGHT;
  const roundedPercentage = Math.round(displayPercentage);

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress arc */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>

      {/* Center text */}
      {showPercentage && (
        <View className="absolute items-center justify-center">
          <Text
            className="font-bold text-slate-800 dark:text-white"
            style={{ fontSize: size * 0.2 }}
          >
            {roundedPercentage}%
          </Text>
          {label ? (
            <Text
              className="text-slate-500 dark:text-slate-400"
              style={{ fontSize: size * 0.1 }}
            >
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
