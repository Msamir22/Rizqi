/**
 * QuickActionMenu - Modal menu for quick actions
 * Triggered by the Add button in the tab bar
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/ui";

// const ACTION_SIZE = 50;
const MENU_BOTTOM_OFFSET = 20;

interface QuickAction {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "transaction",
    iconName: "add-circle",
    label: "Add Transaction",
    route: "/add-transaction",
    color: palette.nileGreen[500],
  },
  {
    id: "account",
    iconName: "wallet-outline",
    label: "Add Account",
    route: "/add-account",
    color: palette.blue[500],
  },
  {
    id: "metals",
    iconName: "hardware-chip-outline",
    label: "Add Metals",
    route: "/metals",
    color: palette.gold[600], // Using gold[600] as main per palette
  },
  {
    id: "transfer",
    iconName: "swap-horizontal",
    label: "Transfer",
    route: "/add-transfer",
    color: palette.violet[500],
  },
  {
    id: "budgets",
    iconName: "pie-chart-outline",
    label: "Budgets",
    route: "/budgets",
    color: palette.orange[500],
  },
];

interface QuickActionMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function QuickActionMenu({
  visible,
  onClose,
}: QuickActionMenuProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const bottomPadding = TAB_BAR_HEIGHT + insets.bottom + MENU_BOTTOM_OFFSET;

  const handlePress = useCallback(
    (route: string) => {
      onClose();
      // Small delay to allow menu close animation
      setTimeout(() => {
        router.push(route as never);
      }, 150);
    },
    [onClose]
  );

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        className="absolute inset-0 bg-black/60 z-[100]"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Menu Options */}
      <View
        className="absolute w-full z-[101] items-center pointer-events-none"
        style={{ bottom: bottomPadding }}
      >
        <Animated.View
          entering={SlideInDown.springify().damping(15)}
          exiting={SlideOutDown.duration(150)}
          className="items-center"
        >
          {QUICK_ACTIONS.map((action) => (
            <View key={action.id} className="items-center mb-5">
              <Pressable
                onPress={() => handlePress(action.route)}
                className="flex-row items-center bg-slate-800 rounded-full pl-4 pr-1 py-1 shadow-lg shadow-black/40 border border-slate-700"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Text className="text-white font-medium mr-3 text-sm">
                  {action.label}
                </Text>
                <View
                  style={{ backgroundColor: action.color }}
                  className="w-10 h-10 rounded-full items-center justify-center"
                >
                  <Ionicons name={action.iconName} size={20} color="white" />
                </View>
              </Pressable>
            </View>
          ))}
        </Animated.View>
      </View>
    </>
  );
}
