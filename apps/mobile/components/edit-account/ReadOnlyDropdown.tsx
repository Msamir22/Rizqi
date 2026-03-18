/**
 * ReadOnlyDropdown Component
 *
 * A disabled dropdown that displays a locked field with a custom styled tooltip.
 * Used for account type and currency fields in the Edit Account screen,
 * which cannot be changed after creation.
 *
 * Architecture & Design Rationale:
 * - Pattern: Presentational Component (no business logic)
 * - SOLID: SRP — displays a locked, read-only dropdown with tooltip
 * - Uses a custom tooltip implementation (not native) per FR-004
 *
 * @module ReadOnlyDropdown
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadOnlyDropdownProps {
  /** Label displayed above the dropdown */
  readonly label: string;
  /** The current value to display */
  readonly displayValue: string;
  /** Optional icon emoji to display */
  readonly icon?: string;
  /** Tooltip text explaining why the field is locked */
  readonly tooltipText?: string;
  /** Additional container className */
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Styles (extracted to avoid react-native/no-inline-styles)
// ---------------------------------------------------------------------------

const TOOLTIP_BASE_STYLE = {
  position: "absolute" as const,
  top: -40,
  right: 0,
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

const TOOLTIP_ARROW_BASE_STYLE = {
  position: "absolute" as const,
  bottom: -6,
  right: 14,
  width: 0,
  height: 0,
  borderLeftWidth: 6,
  borderRightWidth: 6,
  borderTopWidth: 6,
  borderLeftColor: "transparent" as const,
  borderRightColor: "transparent" as const,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A read-only dropdown with a lock icon and custom styled tooltip.
 *
 * Tapping the lock icon reveals a tooltip explaining that the field
 * cannot be changed after creation.
 */
export function ReadOnlyDropdown({
  label,
  displayValue,
  icon,
  tooltipText = "Cannot be changed after creation",
  className = "",
}: ReadOnlyDropdownProps): React.JSX.Element {
  const { isDark } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipOpacity] = useState(new Animated.Value(0));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tooltipBgColor = isDark ? palette.slate[700] : palette.slate[800];

  const tooltipStyle = useMemo(
    () => ({
      ...TOOLTIP_BASE_STYLE,
      opacity: tooltipOpacity,
      backgroundColor: tooltipBgColor,
    }),
    [tooltipOpacity, tooltipBgColor]
  );

  const tooltipArrowStyle = useMemo(
    () => ({
      ...TOOLTIP_ARROW_BASE_STYLE,
      borderTopColor: tooltipBgColor,
    }),
    [tooltipBgColor]
  );

  // Cleanup timeout on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return (): void => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleLockPress = useCallback((): void => {
    // Clear any existing auto-hide timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (showTooltip) {
      // Hide tooltip with fade out
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowTooltip(false));
    } else {
      // Show tooltip with fade in
      setShowTooltip(true);
      Animated.timing(tooltipOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 3 seconds
      timeoutRef.current = setTimeout(() => {
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowTooltip(false));
      }, 3000);
    }
  }, [showTooltip, tooltipOpacity]);

  return (
    <View className={`mb-4 ${className}`}>
      {/* Label */}
      <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </Text>

      {/* Dropdown-like container */}
      <View className="flex-row items-center justify-between px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50">
        {/* Left: Icon + Value */}
        <View className="flex-row items-center flex-1">
          {icon ? (
            <Text className="text-lg mr-2">{icon}</Text>
          ) : null}
          <Text className="text-base font-medium text-slate-500 dark:text-slate-400">
            {displayValue}
          </Text>
        </View>

        {/* Right: Lock icon + Tooltip trigger */}
        <View className="relative">
          <Pressable
            onPress={handleLockPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${label} is locked. Tap for more info.`}
          >
            <Ionicons
              name="lock-closed"
              size={16}
              color={
                isDark ? palette.slate[500] : palette.slate[400]
              }
            />
          </Pressable>

          {/* Custom Tooltip */}
          {showTooltip && (
            <Animated.View style={tooltipStyle}>
              <Text className="text-xs font-medium text-white text-center">
                {tooltipText}
              </Text>
              {/* Arrow */}
              <View style={tooltipArrowStyle} />
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}
