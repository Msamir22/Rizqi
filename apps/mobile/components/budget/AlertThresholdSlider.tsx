/**
 * AlertThresholdSlider Component
 *
 * Slider control for selecting the budget alert threshold (50-100%).
 * Shows real-time percentage text in amber color.
 *
 * Architecture & Design Rationale:
 * - Pattern: Controlled Presentational Component
 * - SOLID: SRP — renders only the threshold slider.
 * - Uses React Native's built-in PanResponder instead of
 *   react-native-gesture-handler to avoid global gesture capture
 *   that interferes with Modal touch handling on Android.
 *
 * @module AlertThresholdSlider
 */

import { palette } from "@/constants/colors";
import React, { useCallback, useRef, useState } from "react";
import {
  PanResponder,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";

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
  const [isMeasured, setIsMeasured] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackXRef = useRef(0);
  const trackRef = useRef<View>(null);

  // Use refs for callbacks to avoid PanResponder stale closures
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const valueRef = useRef(value);
  valueRef.current = value;

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const width = e.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);

    // Measure the absolute X position of the track using the ref
    trackRef.current?.measure(
      (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
        trackXRef.current = pageX;
        setIsMeasured(true);
      }
    );
  }, []);

  const computeValueFromX = useCallback((pageX: number): number => {
    const trackWidth = trackWidthRef.current;
    if (trackWidth === 0) return valueRef.current;

    const relativeX = pageX - trackXRef.current;
    const clampedX = Math.max(0, Math.min(relativeX, trackWidth));
    const raw =
      MIN_THRESHOLD + (clampedX / trackWidth) * (MAX_THRESHOLD - MIN_THRESHOLD);
    const stepped = Math.round(raw / STEP) * STEP;
    return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, stepped));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only capture horizontal drags that exceed a small threshold
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 5
        );
      },
      onPanResponderGrant: (
        evt: GestureResponderEvent,
        _gestureState: PanResponderGestureState
      ) => {
        // Re-measure on grant to ensure trackXRef is accurate even if view scrolled
        trackRef.current?.measure(
          (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
            trackXRef.current = pageX;
            const newValue = computeValueFromX(evt.nativeEvent.pageX);
            onValueChangeRef.current(newValue);
          }
        );
      },
      onPanResponderMove: (
        evt: GestureResponderEvent,
        _gestureState: PanResponderGestureState
      ) => {
        const newValue = computeValueFromX(evt.nativeEvent.pageX);
        onValueChangeRef.current(newValue);
      },
    })
  ).current;

  const normalizedValue =
    (value - MIN_THRESHOLD) / (MAX_THRESHOLD - MIN_THRESHOLD);
  const thumbLeft =
    trackWidth > 0 ? normalizedValue * (trackWidth - THUMB_SIZE) : 0;
  const fillWidth = trackWidth > 0 ? normalizedValue * trackWidth : 0;

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

      <View
        ref={trackRef}
        onLayout={handleLayout}
        className="justify-center"
        style={{ height: THUMB_SIZE + 8 }}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View
          className="w-full rounded-full bg-slate-200 dark:bg-slate-700"
          style={{ height: TRACK_HEIGHT }}
        />

        {isMeasured && (
          <>
            {/* Fill */}
            <View
              className="absolute rounded-full"
              style={{
                height: TRACK_HEIGHT,
                width: fillWidth,
                backgroundColor: palette.gold[600],
              }}
            />

            {/* Thumb */}
            <View
              className="absolute rounded-full"
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                left: thumbLeft,
                backgroundColor: palette.gold[600],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 3,
              }}
            />
          </>
        )}
      </View>

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
