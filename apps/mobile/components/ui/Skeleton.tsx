/**
 * Reusable Skeleton Shimmer Component
 *
 * A composable primitive for building loading placeholders.
 * Each page composes page-specific skeleton layouts from these primitives.
 *
 * Architecture & Design Rationale:
 * - Pattern: Composable Primitive (Atomic Design)
 * - Why: A single primitive can be composed into any page-specific loading layout.
 *   Avoids duplicating animation/shimmer logic per page.
 * - SOLID: SRP — renders only a shimmer block.
 *   Open/Closed — new layouts composed without modifying the primitive.
 *
 * @module Skeleton
 */

import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, View, type ViewStyle } from "react-native";

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkeletonProps {
  /** Width of the skeleton block (number for dp, string for percentage) */
  readonly width: number | string;
  /** Height of the skeleton block in dp */
  readonly height: number;
  /** Border radius for the skeleton block. Default: 8 */
  readonly borderRadius?: number;
  /** Additional styles to apply to the container */
  readonly style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANIMATION_DURATION_MS = 1200;

/** Shimmer base colors per theme */
const SHIMMER_COLORS = {
  light: {
    base: palette.slate[200],
    highlight: palette.slate[100],
  },
  dark: {
    base: palette.slate[700],
    highlight: palette.slate[600],
  },
} as const;

const SHIMMER_GRADIENT_STYLE: ViewStyle = {
  flex: 1,
  width: 400,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A shimmer skeleton placeholder for loading states.
 *
 * Usage:
 * ```tsx
 * // Single skeleton block
 * <Skeleton width={200} height={20} borderRadius={4} />
 *
 * // Compose into a page skeleton
 * <View>
 *   <Skeleton width="100%" height={120} borderRadius={16} />
 *   <Skeleton width="60%" height={16} style={{ marginTop: 12 }} />
 *   <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
 * </View>
 * ```
 */
export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps): React.JSX.Element {
  const { isDark } = useTheme();
  const shimmerTranslate = useRef(new Animated.Value(-1)).current;

  const colors = isDark ? SHIMMER_COLORS.dark : SHIMMER_COLORS.light;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 1,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      })
    );

    animation.start();

    return (): void => {
      animation.stop();
    };
  }, [shimmerTranslate]);

  const containerStyle: ViewStyle = {
    width: width as number,
    height,
    borderRadius,
    backgroundColor: colors.base,
    overflow: "hidden",
  };

  const translateX = shimmerTranslate.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={[containerStyle, style]}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[colors.base, colors.highlight, colors.base]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={SHIMMER_GRADIENT_STYLE}
        />
      </Animated.View>
    </View>
  );
}
