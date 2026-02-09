import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { palette } from "@/constants/colors";
import { QUICK_ACTION_SIZE, QUICK_ACTION_SPRING_CONFIG } from "@/constants/ui";
import { useTheme } from "@/context/ThemeContext";

interface QuickActionButtonProps {
  /** Icon name from Ionicons */
  iconName: keyof typeof Ionicons.glyphMap;
  /** Callback when button is pressed */
  onPress: () => void;
  /** Accessibility label for screen readers */
  accessibilityLabel: string;
  /** Animated scale value for the button */
  scale: SharedValue<number>;
  /** Animated translateX value for horizontal positioning */
  translateX: SharedValue<number>;
  /** Animated translateY value for vertical positioning */
  translateY: SharedValue<number>;
  /** Size of the button (optional, defaults to QUICK_ACTION_SIZE) */
  size?: number;
}

/**
 * QuickActionButton - Animated quick action button that expands from the mic button
 *
 * Uses react-native-reanimated for smooth GPU-accelerated animations.
 * Renders a circular button with an icon that scales and translates.
 */
function QuickActionButtonComponent({
  iconName,
  onPress,
  accessibilityLabel,
  scale,
  translateX,
  translateY,
  size = QUICK_ACTION_SIZE,
}: QuickActionButtonProps): React.ReactElement {
  const { isDark } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: withSpring(scale.value, QUICK_ACTION_SPRING_CONFIG) },
    ],
    opacity: withSpring(scale.value, QUICK_ACTION_SPRING_CONFIG),
  }));

  return (
    <Animated.View className="absolute" style={animatedStyle}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessible
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
        className="items-center justify-center bg-slate-50 dark:bg-slate-700 shadow-md shadow-slate-500 dark:shadow-black elevation-6"
      >
        <Ionicons
          name={iconName}
          size={size * 0.5}
          color={isDark ? palette.slate[25] : palette.slate[800]}
        />
      </Pressable>
    </Animated.View>
  );
}

export const QuickActionButton = React.memo(QuickActionButtonComponent);
