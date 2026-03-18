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
import React, { useCallback, useMemo, useState } from "react";
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

  const handleLockPress = useCallback((): void => {
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
      setTimeout(() => {
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowTooltip(false));
      }, 3000);
    }
  }, [showTooltip, tooltipOpacity]);

  return (
    <View className={`mb-3 ${className}`}>
      <Text className="input-label mb-2">{label}</Text>

      <View className="relative">
        <View className="rounded-2xl border border-slate-200/60 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/50 overflow-hidden">
          <View className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                {icon && (
                  <View className="mr-3 w-8 items-center">
                    <Text className="text-xl">{icon}</Text>
                  </View>
                )}
                <Text className="text-base font-medium text-slate-500 dark:text-slate-400">
                  {displayValue}
                </Text>
              </View>

              <Pressable
                onPress={handleLockPress}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={isDark ? palette.slate[500] : palette.slate[400]}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Custom styled tooltip */}
        {showTooltip && (
          <Animated.View style={tooltipStyle}>
            <Text
              className="text-xs font-medium"
              style={{ color: palette.slate[100] }}
            >
              {tooltipText}
            </Text>
            {/* Tooltip arrow */}
            <View style={tooltipArrowStyle} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}
