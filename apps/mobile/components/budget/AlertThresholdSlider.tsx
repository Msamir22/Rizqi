/**
 * AlertThresholdSlider Component
 *
 * Slider control for selecting the budget alert threshold (50-100%).
 * Shows real-time percentage text in amber color.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Presentational Component
 * - SOLID: SRP — renders only the threshold slider.
 *
 * @module AlertThresholdSlider
 */

import { palette } from "@/constants/colors";
import React, { useCallback } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertThresholdSliderProps {
  /** Current threshold value (50-100) */
  readonly value: number;
  /** Callback when value changes */
  readonly onValueChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_THRESHOLD = 50;
const MAX_THRESHOLD = 100;
const STEP = 5;
const THUMB_SIZE = 24;
const TRACK_HEIGHT = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertThresholdSlider({
  value,
  onValueChange,
}: AlertThresholdSliderProps): React.JSX.Element {
  const trackWidth = useSharedValue(0);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent): void => {
      trackWidth.value = e.nativeEvent.layout.width;
    },
    [trackWidth]
  );

  const normalizedValue = useDerivedValue(() => {
    return (value - MIN_THRESHOLD) / (MAX_THRESHOLD - MIN_THRESHOLD);
  }, [value]);

  const thumbPosition = useAnimatedStyle(() => ({
    left:
      trackWidth.value > 0
        ? normalizedValue.value * (trackWidth.value - THUMB_SIZE)
        : 0,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: trackWidth.value > 0 ? normalizedValue.value * trackWidth.value : 0,
  }));

  const panGesture = Gesture.Pan().onUpdate((e) => {
    "worklet";
    if (trackWidth.value === 0) return;
    const clampedX = Math.max(0, Math.min(e.x, trackWidth.value));
    const raw =
      MIN_THRESHOLD +
      (clampedX / trackWidth.value) * (MAX_THRESHOLD - MIN_THRESHOLD);
    const stepped = Math.round(raw / STEP) * STEP;
    const clamped = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, stepped));
    runOnJS(onValueChange)(clamped);
  });

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Alert Threshold
        </Text>
        <Text
          className="text-sm font-bold"
          style={{ color: palette.gold[600] }}
        >
          {Math.round(value)}%
        </Text>
      </View>

      <GestureDetector gesture={panGesture}>
        <View
          onLayout={handleLayout}
          className="justify-center"
          style={{ height: THUMB_SIZE + 8 }}
        >
          {/* Track background */}
          <View
            className="w-full rounded-full bg-slate-200 dark:bg-slate-700"
            style={{ height: TRACK_HEIGHT }}
          />

          {/* Fill */}
          <Animated.View
            className="absolute rounded-full"
            style={[
              { height: TRACK_HEIGHT, backgroundColor: palette.gold[600] },
              fillStyle,
            ]}
          />

          {/* Thumb */}
          <Animated.View
            className="absolute rounded-full"
            style={[
              // eslint-disable-next-line react-native/no-inline-styles
              {
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                backgroundColor: palette.gold[600],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 3,
              },
              thumbPosition,
            ]}
          />
        </View>
      </GestureDetector>

      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-slate-400 dark:text-slate-500">
          {MIN_THRESHOLD}%
        </Text>
        <Text className="text-xs text-slate-400 dark:text-slate-500">
          {MAX_THRESHOLD}%
        </Text>
      </View>

      <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {"You\u2019ll be alerted when spending reaches this percentage"}
      </Text>
    </View>
  );
}
