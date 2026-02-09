/**
 * ActionItem - Individual quick action button for the FAB menu
 * Animates from center outward with spring physics
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { palette } from "@/constants/colors";

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

interface ActionItemProps {
  /** Icon name from Ionicons */
  iconName: keyof typeof Ionicons.glyphMap;
  /** Label displayed below icon */
  label: string;
  /** Callback when pressed */
  onPress: () => void;
  /** Animated scale value (0 = hidden, 1 = visible) */
  scale: SharedValue<number>;
  /** Horizontal offset from FAB */
  offsetX: number;
  /** Vertical offset from FAB */
  offsetY: number;
  /** Index for staggered animation delay */
  index: number;
}

function ActionItemComponent({
  iconName,
  label,
  onPress,
  scale,
  offsetX,
  offsetY,
  index,
}: ActionItemProps): React.JSX.Element {
  const animatedStyle = useAnimatedStyle(() => {
    const animatedScale = withSpring(scale.value, {
      ...SPRING_CONFIG,
      // Stagger delay based on index
      damping: SPRING_CONFIG.damping + index * 2,
    });

    return {
      opacity: animatedScale,
      transform: [
        { translateX: withSpring(scale.value * offsetX, SPRING_CONFIG) },
        { translateY: withSpring(scale.value * offsetY, SPRING_CONFIG) },
        { scale: animatedScale },
      ],
    };
  });

  return (
    <Animated.View
      className="absolute items-center w-[70px]"
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        className="w-[52px] h-[52px] rounded-[26px] items-center justify-center bg-white dark:bg-slate-700 shadow-md shadow-slate-400 dark:shadow-black elevation-6"
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1,
        })}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <Ionicons name={iconName} size={24} color={palette.nileGreen[500]} />
      </Pressable>
      <Text
        className="mt-1.5 text-[11px] font-semibold text-center text-slate-600 dark:text-slate-300"
        numberOfLines={2}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export const ActionItem = React.memo(ActionItemComponent);
