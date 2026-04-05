import { palette } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import type { NavigationLevel } from "@/hooks/useCategoryNavigation";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface BreadcrumbProps {
  /** Full navigation stack from useCategoryNavigation */
  readonly stack: readonly NavigationLevel[];
  /** Handler when user taps a breadcrumb segment (jump to level) */
  readonly onJumpToLevel: (index: number) => void;
  /** Handler when user taps the back arrow */
  readonly onGoBack: () => void;
}

const BREADCRUMB_SEPARATOR = ">";

/**
 * Horizontal breadcrumb trail for the category drill-down navigation.
 * Each segment is tappable. Shows a back arrow on the left.
 *
 * Only rendered when depth > 0 (not at root level).
 */
export function Breadcrumb({
  stack,
  onJumpToLevel,
  onGoBack,
}: BreadcrumbProps): React.JSX.Element {
  const { isDark } = useTheme();
  const handleSegmentPress = useCallback(
    (index: number) => {
      onJumpToLevel(index);
    },
    [onJumpToLevel]
  );

  const lastIndex = stack.length - 1;

  return (
    <View className="flex-row items-center px-4 py-3">
      {/* Back arrow */}
      <TouchableOpacity
        onPress={onGoBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="me-1 p-1"
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={isDark ? palette.slate[500] : palette.slate[400]}
        />
      </TouchableOpacity>

      {/* Scrollable breadcrumb segments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center"
      >
        {stack.map((level, index) => {
          const isLast = index === lastIndex;

          return (
            <React.Fragment key={level.label + index}>
              {index > 0 && (
                <Text className="mx-1.5 text-xs text-slate-500 dark:text-slate-600">
                  {BREADCRUMB_SEPARATOR}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => handleSegmentPress(index)}
                disabled={isLast}
                className={`px-2.5 py-1 rounded-full ${
                  isLast ? "bg-slate-200 dark:bg-slate-700" : "bg-transparent"
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${level.label}`}
              >
                <Text
                  numberOfLines={1}
                  className={`text-xs font-medium ${
                    isLast
                      ? "text-slate-800 dark:text-slate-100 font-bold"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}
