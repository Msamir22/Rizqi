/**
 * Reusable Tooltip Component
 *
 * A styled tooltip with animated fade in/out, auto-dismiss, and arrow pointer.
 * Extracted from ReadOnlyDropdown for reuse across the app.
 *
 * Architecture & Design Rationale:
 * - Pattern: Extract & Reuse (DRY)
 * - Why: The same tooltip pattern is needed in ReadOnlyDropdown and MetalsHeroCard.
 *   Extracting avoids duplicating animation and positioning logic.
 * - SOLID: Single Responsibility — tooltip handles only display + animation.
 *
 * @module Tooltip
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import ReanimatedAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TooltipPosition = "top" | "bottom";
type ArrowAlignment = "left" | "center" | "right";

interface TooltipProps {
  /** The text content to display inside the tooltip */
  readonly text: string;
  /** Whether the tooltip is currently visible */
  readonly visible: boolean;
  /** Callback when the tooltip should be dismissed */
  readonly onDismiss: () => void;
  /** Position relative to the anchor element. Default: "top" */
  readonly position?: TooltipPosition;
  /** Horizontal alignment of the arrow. Default: "right" */
  readonly arrowAlignment?: ArrowAlignment;
  /** Auto-dismiss timeout in milliseconds. Set to 0 to disable. Default: 3000 */
  readonly autoDismissMs?: number;
  /** Animation duration in milliseconds. Default: 200 */
  readonly animationDurationMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_AUTO_DISMISS_MS = 3000;
const DEFAULT_ANIMATION_DURATION_MS = 200;
const ARROW_SIZE = 6;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function getTooltipBaseStyle(
  position: TooltipPosition
): Record<string, unknown> {
  const base: ViewStyle = {
    position: "absolute" as const,
    zIndex: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  };

  if (position === "top") {
    return { ...base, bottom: "100%", marginBottom: 8 };
  }

  return { ...base, top: "100%", marginTop: 8 };
}

function getArrowBaseStyle(
  position: TooltipPosition,
  alignment: ArrowAlignment
): Record<string, unknown> {
  const horizontalPosition: Record<string, unknown> = {};

  switch (alignment) {
    case "left":
      horizontalPosition.left = 14;
      break;
    case "center":
      horizontalPosition.alignSelf = "center";
      break;
    case "right":
      horizontalPosition.right = 14;
      break;
  }

  const base = {
    position: "absolute" as const,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderLeftColor: "transparent" as const,
    borderRightColor: "transparent" as const,
    ...horizontalPosition,
  };

  if (position === "top") {
    return {
      ...base,
      bottom: -ARROW_SIZE,
      borderTopWidth: ARROW_SIZE,
    };
  }

  return {
    ...base,
    top: -ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A styled tooltip with animated fade in/out and auto-dismiss.
 *
 * Usage:
 * ```tsx
 * <View style={{ position: 'relative' }}>
 *   <Pressable onPress={() => setShowTooltip(true)}>
 *     <Text>Info Icon</Text>
 *   </Pressable>
 *   <Tooltip
 *     text="Your explanation here"
 *     visible={showTooltip}
 *     onDismiss={() => setShowTooltip(false)}
 *     position="top"
 *     arrowAlignment="right"
 *   />
 * </View>
 * ```
 */
export function Tooltip({
  text,
  visible,
  onDismiss,
  position = "top",
  arrowAlignment = "right",
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
  animationDurationMs = DEFAULT_ANIMATION_DURATION_MS,
}: TooltipProps): React.JSX.Element | null {
  const { isDark } = useTheme();
  const opacity = useSharedValue(0);
  const [isRendered, setIsRendered] = useState(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const tooltipBgColor = isDark ? palette.slate[700] : palette.slate[800];

  const clearAutoDismissTimer = useCallback((): void => {
    if (autoDismissTimerRef.current !== null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      opacity.value = withTiming(1, { duration: animationDurationMs });

      if (autoDismissMs > 0) {
        clearAutoDismissTimer();
        autoDismissTimerRef.current = setTimeout(() => {
          opacity.value = withTiming(
            0,
            { duration: animationDurationMs },
            (finished) => {
              if (finished) {
                runOnJS(setIsRendered)(false);
                runOnJS(onDismiss)();
              }
            }
          );
        }, autoDismissMs);
      }
    } else {
      opacity.value = withTiming(
        0,
        { duration: animationDurationMs },
        (finished) => {
          if (finished) {
            runOnJS(setIsRendered)(false);
          }
        }
      );
    }

    return clearAutoDismissTimer;
  }, [
    visible,
    autoDismissMs,
    animationDurationMs,
    onDismiss,
    clearAutoDismissTimer,
    opacity,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const tooltipStyle = useMemo(
    () => ({
      ...getTooltipBaseStyle(position),
      backgroundColor: tooltipBgColor,
    }),
    [position, tooltipBgColor]
  );

  const arrowStyle = useMemo(
    () => ({
      ...getArrowBaseStyle(position, arrowAlignment),
      ...(position === "top"
        ? { borderTopColor: tooltipBgColor }
        : { borderBottomColor: tooltipBgColor }),
    }),
    [position, arrowAlignment, tooltipBgColor]
  );

  if (!isRendered) {
    return null;
  }

  return (
    <ReanimatedAnimated.View style={[tooltipStyle, animatedStyle]}>
      <Pressable onPress={onDismiss}>
        <Text
          className="text-xs font-medium"
          style={{ color: palette.slate[100] }}
        >
          {text}
        </Text>
      </Pressable>
      <View style={arrowStyle} />
    </ReanimatedAnimated.View>
  );
}
